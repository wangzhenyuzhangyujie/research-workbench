"""Exercise disposable servers only: persistence, conflicts, history, and origin checks."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]

def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]

def request(base, path, method='GET', data=None, headers=None):
    supplied = {'Content-Type': 'application/json', **(headers or {})}
    req = Request(base + path, method=method, headers=supplied,
                  data=json.dumps(data).encode() if data is not None else None)
    try:
        with urlopen(req, timeout=10) as response:
            body = response.read()
            return response.status, json.loads(body) if 'application/json' in response.headers.get('Content-Type', '') else body
    except HTTPError as error:
        return error.code, error.read()

def wait(base, path):
    for _ in range(100):
        try:
            if request(base, path)[0] == 200:
                return
        except (URLError, TimeoutError):
            pass
        time.sleep(.2)
    raise RuntimeError('Server did not become ready: ' + base)

def stop(process):
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()

with tempfile.TemporaryDirectory() as temporary:
    scratch = Path(temporary)
    env = {**os.environ, 'REBUTTAL_DB': str(scratch / 'drafts.sqlite'), 'NEXT_TELEMETRY_DISABLED': '1'}
    port = free_port()
    base = f'http://127.0.0.1:{port}'
    command = ['node', 'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', str(port)]
    with (scratch / 'rebuttal.log').open('w') as log:
        process = subprocess.Popen(command, cwd=ROOT / 'apps/rebuttal', env=env, stdout=log, stderr=log)
        try:
            wait(base, '/api/drafts')
            initial = request(base, '/api/drafts')[1]['documents'][0]
            changed = {**initial, 'en': initial['en'] + '\n\nAPI smoke test.'}
            payload = {'document': changed, 'baseRevision': 0, 'label': 'Smoke test'}
            status, saved = request(base, '/api/drafts', 'PUT', payload)
            assert status == 200 and saved['document']['revision'] == 1
            assert request(base, '/api/drafts', 'PUT', payload)[0] == 409
            assert request(base, '/api/drafts', 'PUT', {**payload, 'baseRevision': 1}, {'Origin': 'https://example.invalid'})[0] == 403
            assert request(base, '/api/drafts', headers={'Host': 'example.invalid'})[0] == 403
            assert request(base, '/api/drafts', 'PUT', {'document': {**changed, 'stage': 'ready'}, 'baseRevision': 1, 'label': ''})[0] == 400
            versions = request(base, '/api/drafts?history=' + initial['id'])[1]['versions']
            assert [v['revision'] for v in versions] == [1, 0]
            status, restored = request(base, '/api/drafts', 'PUT', {'document': initial, 'baseRevision': 1, 'label': 'Restore'})
            assert status == 200 and restored['document']['revision'] == 2
        finally:
            stop(process)
        process = subprocess.Popen(command, cwd=ROOT / 'apps/rebuttal', env=env, stdout=log, stderr=log)
        try:
            wait(base, '/api/drafts')
            current = request(base, '/api/drafts')[1]['documents'][0]
            assert current['revision'] == 2 and current['en'] == initial['en']
        finally:
            stop(process)

    workspace = scratch / 'paper'
    shutil.copytree(ROOT / 'apps/paper-compare/examples', workspace)
    env = {**os.environ, 'PAPER_WORKSPACE': str(workspace)}
    python = os.environ.get('PAPER_PYTHON', str(ROOT / 'apps/paper-compare/.venv/bin/python'))
    port = free_port()
    base = f'http://127.0.0.1:{port}'
    with (scratch / 'paper.log').open('w') as log:
        process = subprocess.Popen([python, 'scripts/serve.py', str(port)], cwd=ROOT / 'apps/paper-compare', env=env, stdout=log, stderr=log)
        try:
            wait(base, '/api/annotations')
            payload = {'action': 'save', 'id': 'api-smoke-note-0001', 'paper': 'draft', 'block_id': 'motivation', 'body': 'Please clarify this paragraph.', 'expected_revision': 0}
            status, saved = request(base, '/api/annotations', 'POST', payload)
            assert status == 200 and saved['comment']['revision'] == 1
            assert request(base, '/api/annotations', 'POST', {**payload, 'body': 'A stale edit'})[0] == 409
            assert request(base, '/api/annotations', 'POST', payload, {'Origin': 'https://example.invalid'})[0] == 403
            assert request(base, '/api/annotations', headers={'Host': 'example.invalid'})[0] == 403
            assert request(base, '/annotations/comments.json')[0] == 404
            assert request(base, '/web/../annotations/comments.json')[0] == 404
            assert request(base, '/api/annotations/export')[0] == 200
            text = (workspace / 'draft/content.tex').read_text()
            (workspace / 'draft/content.tex').write_text(text.replace('Readers need', 'Readers often need'))
            notes = request(base, '/api/annotations')[1]['comments']
            assert notes[0]['source_changed']
            # Watcher must invalidate the old translation and preserve the comment.
            for _ in range(60):
                page = request(base, '/web/index.html')[1].decode()
                if 'Readers often need' in page and '译文待更新' in page:
                    break
                time.sleep(.2)
            else:
                raise AssertionError('Changed source did not update the reading page')
            assert request(base, '/api/annotations')[1]['comments'][0]['body'] == payload['body']
        finally:
            stop(process)
print('API smoke checks passed: save/conflict/restore/restart, origin checks, annotations, source invalidation.')
