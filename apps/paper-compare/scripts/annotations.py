"""Local paragraph annotations, independent of manuscript builds."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import re
import threading
import uuid


class AnnotationError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


class AnnotationStore:
    def __init__(self, root, block_loader):
        self.root = Path(root)
        self.directory = self.root / 'annotations'
        self.path = self.directory / 'comments.json'
        self.block_loader = block_loader
        self.lock = threading.RLock()

    def _read(self):
        if not self.path.exists():
            return {'schema_version': 1, 'updated_at': None, 'comments': []}
        try:
            data = json.loads(self.path.read_text())
            if not isinstance(data, dict) or data.get('schema_version') != 1 or not isinstance(data.get('comments'), list):
                raise ValueError('invalid annotation document')
            for row in data['comments']:
                if (not isinstance(row, dict) or not all(k in row for k in
                        ('id', 'paper', 'status', 'body', 'revision', 'created_at', 'updated_at', 'source_hash'))
                        or row['paper'] not in ('draft', 'reference')
                        or row['status'] not in ('open', 'resolved', 'deleted')
                        or type(row['revision']) is not int or not isinstance(row['body'], str)):
                    raise ValueError('invalid annotation record')
            return data
        except (ValueError, OSError) as exc:
            raise AnnotationError('批注文件暂时无法读取；原文件已保留，请联系我检查。', 503) from exc

    def _blocks(self, paper):
        return {b['id']: b for b in self.block_loader(paper)}

    @staticmethod
    def _hash(block):
        return hashlib.sha256(block['tex'].encode()).hexdigest()

    @staticmethod
    def _text(payload, key, limit, required=False):
        value = payload.get(key, '')
        if not isinstance(value, str) or len(value) > limit:
            raise AnnotationError('批注内容过长或格式不正确。')
        if required and not value.strip():
            raise AnnotationError('请先填写修改意见。')
        return value.strip()

    @staticmethod
    def _atomic(path, text):
        temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
        try:
            with temporary.open('w') as f:
                f.write(text)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temporary, path)
        finally:
            if temporary.exists():
                temporary.unlink()

    def _write(self, data):
        self.directory.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            self._atomic(self.directory / 'comments.previous.json', self.path.read_text())
        self._atomic(self.path, json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        self._atomic(self.directory / 'review.md', self.markdown(data))

    def snapshot(self):
        with self.lock:
            data = self._read()
            blocks = {paper: self._blocks(paper) for paper in ('draft', 'reference')}
            comments = []
            for row in data['comments']:
                if row['status'] == 'deleted':
                    continue
                item = dict(row)
                block = blocks[row['paper']].get(row.get('block_id'))
                item['source_missing'] = bool(row.get('block_id')) and block is None
                item['source_changed'] = bool(block) and self._hash(block) != row.get('source_hash')
                comments.append(item)
            return {'schema_version': 1, 'updated_at': data['updated_at'], 'comments': comments}

    def mutate(self, payload):
        if not isinstance(payload, dict):
            raise AnnotationError('批注格式不正确。')
        action = payload.get('action')
        if action not in ('save', 'status', 'delete', 'restore'):
            raise AnnotationError('未知的批注操作。')
        note_id = payload.get('id')
        if not isinstance(note_id, str) or not re.fullmatch(r'[a-zA-Z0-9-]{8,80}', note_id):
            raise AnnotationError('批注标识不正确。')
        expected = payload.get('expected_revision')
        if type(expected) is not int or expected < 0:
            raise AnnotationError('批注版本不正确。')
        with self.lock:
            data = self._read()
            current = next((r for r in data['comments'] if r['id'] == note_id), None)
            # External review sessions supply an immutable author ID. Local authors
            # omit this field and retain their existing moderation permissions.
            author_id = self._text(payload, 'author_id', 80)
            if author_id and not re.fullmatch(r'reviewer-[a-f0-9]{32}', author_id):
                raise AnnotationError('审阅身份不正确。')
            if current is not None and author_id and current.get('author_id') != author_id:
                raise AnnotationError('只能修改自己留下的批注。', 403)
            if current is None and action != 'save':
                raise AnnotationError('没有找到这条批注。', 404)
            if current is not None and current['revision'] != expected:
                # A lost response followed by the same request must not create a duplicate.
                if (action == 'save' and expected == 0 and current['revision'] == 1
                        and isinstance(payload.get('body'), str)
                        and current['body'] == payload['body'].strip()
                        and current['paper'] == payload.get('paper')
                        and current.get('block_id') == payload.get('block_id')):
                    return dict(current)
                raise AnnotationError('这条批注已在别处更新；你的草稿仍保留，请重新打开最新批注。', 409)
            if current is None and expected != 0:
                raise AnnotationError('这条批注已发生变化，请重新载入。', 409)
            now = datetime.now(timezone.utc).isoformat()
            if action == 'save':
                body = self._text(payload, 'body', 20000, required=True)
                if current is None:
                    paper = payload.get('paper')
                    if paper not in ('draft', 'reference'):
                        raise AnnotationError('请选择对应的论文。')
                    block_id = payload.get('block_id')
                    if block_id is not None and not isinstance(block_id, str):
                        raise AnnotationError('段落标识不正确。')
                    block = self._blocks(paper).get(block_id) if block_id else None
                    if block_id and block is None:
                        raise AnnotationError('当前稿件里已找不到这一段；请重新定位，草稿仍保留。', 409)
                    anchor_hash = self._text(payload, 'source_hash', 64)
                    if anchor_hash and not re.fullmatch(r'[a-f0-9]{64}', anchor_hash):
                        raise AnnotationError('段落版本不正确。')
                    current = {'id': note_id, 'paper': paper, 'block_id': block_id,
                               'section': block['align'] if block else 'whole',
                               'kind': block['kind'] if block else 'whole',
                               'source_hash': anchor_hash or (self._hash(block) if block else ''),
                               'source_tex_at_save': block['tex'] if block else '',
                               'source_hash_at_save': self._hash(block) if block else '',
                               'quote': self._text(payload, 'quote', 4000),
                               'context_zh': self._text(payload, 'context_zh', 24000),
                               'created_at': now, 'revision': 0, 'status': 'open', 'resolution': ''}
                    if author_id:
                        current['author_id'] = author_id
                        current['author_name'] = self._text(payload, 'author_name', 60, required=True)
                    data['comments'].append(current)
                elif current['status'] == 'deleted':
                    raise AnnotationError('请先恢复这条批注。', 409)
                current['body'] = body
                if 'quote' in payload:
                    current['quote'] = self._text(payload, 'quote', 4000)
            elif action == 'status':
                status = payload.get('status')
                if status not in ('open', 'resolved') or current['status'] == 'deleted':
                    raise AnnotationError('批注状态不正确。')
                current['status'] = status
                if 'resolution' in payload:
                    current['resolution'] = self._text(payload, 'resolution', 20000)
                current['resolved_at'] = now if status == 'resolved' else None
            elif action == 'delete':
                current['previous_status'] = current['status'] if current['status'] != 'deleted' else 'open'
                current['status'] = 'deleted'
            else:
                current['status'] = current.get('previous_status', 'open')
                if current['status'] not in ('open', 'resolved'):
                    current['status'] = 'open'
            current['revision'] += 1
            current['updated_at'] = now
            data['updated_at'] = now
            self._write(data)
            return dict(current)

    def markdown(self, data=None):
        if data is None:
            with self.lock:
                data = self._read()
        notes = [r for r in data['comments'] if r['status'] != 'deleted']
        lines = ['# 论文工作台批注', '',
                 '这些是用户在工作台保存的审阅意见。用户要求按批注改稿后，逐条对照对应段落处理。',
                 '正文更新不会自动完成批注；处理后保留原意见并记录修改说明。', '',
                 f'待修改 {sum(r["status"] == "open" for r in notes)} 条；已处理 {sum(r["status"] == "resolved" for r in notes)} 条。', '']
        for r in sorted(notes, key=lambda n: (n['status'] != 'open', n['created_at'])):
            label = '待修改' if r['status'] == 'open' else '已处理'
            lines += [f'## {label} · {r["paper"]} · {r.get("block_id") or "整篇"}', '',
                      f'- 批注 ID：{r["id"]}', f'- 版本：{r["revision"]}',
                      f'- 创建时间：{r["created_at"]}', f'- 原稿标记：{r["source_hash"]}', '', '### 修改意见', '']
            if r.get('author_name'):
                lines.insert(len(lines) - 3, '- 审阅者：' + r['author_name'])
            lines += ['> ' + line for line in r['body'].splitlines()]
            excerpt = r.get('quote') or r.get('context_zh', '')
            if excerpt:
                lines += ['', '### 批注时的中文内容', ''] + ['> ' + line for line in excerpt.splitlines()]
            if r.get('resolution'):
                lines += ['', '### 处理说明', ''] + ['> ' + line for line in r['resolution'].splitlines()]
            lines += ['']
        return '\n'.join(lines)
