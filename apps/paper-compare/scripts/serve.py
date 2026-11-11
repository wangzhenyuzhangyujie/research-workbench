from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
import threading,time,json,sys,traceback
from build import build,R,APP,parse
from annotations import AnnotationStore,AnnotationError
STATE={'message':'监听中 · 保存 TeX 后自动更新','building':False,'last_error':None}
ANNOTATIONS=AnnotationStore(R,parse)

def fingerprint():
 paths=[APP/'web/template.html',R/'sources/alignment.json',R/'sources/figure_table_placement.json']
 paths+=list((APP/'web/assets').glob('*'))
 for paper in ['draft','reference']:
  paths += [R/paper/'content.tex',R/paper/'main.tex']+list((R/paper).glob('*.bib'))
 paths+=list((R/'figures').glob('*'))+list((R/'translations').glob('*.json'))
 return [(str(p),p.stat().st_mtime_ns,p.stat().st_size) for p in paths if p.is_file()]

def watch():
 prev=fingerprint()
 while True:
  time.sleep(1)
  now=fingerprint()
  if now==prev:continue
  # brief debounce for editor atomic saves
  time.sleep(.8);before=fingerprint();STATE.update(message='TeX 已变化 · 正在重建…',building=True,last_error=None)
  try:
   build('--pdf' in sys.argv);STATE.update(message='同步完成 · 请检查译文状态',building=False,updated=time.time())
  except Exception as e:
   STATE.update(message='构建失败 · 请检查英文 TeX 与构建日志',building=False,last_error=str(e));(R/'qa/watch_error.txt').write_text(traceback.format_exc())
  after=fingerprint()
  # An edit during translation must trigger another build, not be swallowed.
  source_only=lambda xs:[x for x in xs if '/translations/' not in x[0]]
  prev=before if source_only(before)!=source_only(after) else after

class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(R),**kw)
 def json_response(self,status,data):
  b=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
 def do_POST(self):
  if urlsplit(self.path).path!='/api/annotations':return self.json_response(404,{'error':'没有找到此功能。'})
  port=self.server.server_address[1]
  hosts={f'127.0.0.1:{port}',f'localhost:{port}'}
  origin=self.headers.get('Origin')
  if self.headers.get('Host') not in hosts or (origin and origin not in {'http://'+h for h in hosts}):
   return self.json_response(403,{'error':'请从本机论文工作台保存批注。'})
  if self.headers.get_content_type()!='application/json':return self.json_response(415,{'error':'请使用工作台的保存按钮。'})
  try:
   length=int(self.headers.get('Content-Length','0'))
   if not 0<length<=160000:raise AnnotationError('批注内容过长或为空。')
   payload=json.loads(self.rfile.read(length).decode('utf-8'))
   item=ANNOTATIONS.mutate(payload)
   return self.json_response(200,{'comment':item})
  except AnnotationError as exc:return self.json_response(exc.status,{'error':str(exc)})
  except (ValueError,UnicodeError):return self.json_response(400,{'error':'批注内容格式不正确。'})
  except Exception:
   traceback.print_exc();return self.json_response(500,{'error':'保存未完成，你的草稿仍保留，请重试。'})
 def do_GET(self):
  port=self.server.server_address[1]
  if self.headers.get('Host') not in {f'127.0.0.1:{port}',f'localhost:{port}'}:
   return self.json_response(403,{'error':'请从本机工作台访问。'})
  path=urlsplit(self.path).path
  if path=='/api/annotations':
   try:return self.json_response(200,ANNOTATIONS.snapshot())
   except AnnotationError as exc:return self.json_response(exc.status,{'error':str(exc)})
  if path=='/api/annotations/export':
   try:
    b=ANNOTATIONS.markdown().encode();self.send_response(200);self.send_header('Content-Type','text/markdown; charset=utf-8');self.send_header('Content-Disposition','attachment; filename="paper-annotations.md"');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b);return
   except AnnotationError as exc:return self.json_response(exc.status,{'error':str(exc)})
  if path=='/status':
   b=json.dumps(STATE,ensure_ascii=False).encode();self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(b);return
  if path=='/':self.send_response(302);self.send_header('Location','/web/index.html');self.end_headers();return
  return super().do_GET()
 def translate_path(self,path):
  # Resolve decoded URL paths first, then allow only reading artifacts.
  target=Path(super().translate_path(path)).resolve()
  try:relative=target.relative_to(R)
  except ValueError:return str(R/'__not_found__')
  allowed=(relative.parts and relative.parts[0] in {'web','draft','reference','figures'}
           and not any(part.startswith('.') for part in relative.parts)
           and target.suffix in {'.html','.css','.js','.json','.pdf','.tex','.png','.svg','.jpg','.jpeg','.webp'})
  return str(target) if allowed else str(R/'__not_found__')
 def do_HEAD(self):
  port=self.server.server_address[1]
  if self.headers.get('Host') not in {f'127.0.0.1:{port}',f'localhost:{port}'}:self.send_error(403);return
  return super().do_HEAD()
 def list_directory(self,path):
  self.send_error(403);return None
 def end_headers(self):self.send_header('Cache-Control','no-cache');super().end_headers()
 def log_message(self,*a):pass

if __name__=='__main__':
 args=[a for a in sys.argv[1:] if not a.startswith('--')]
 port=int(args[0]) if args else 8767
 build('--pdf' in sys.argv)
 threading.Thread(target=watch,daemon=True).start()
 print(f'Paper workbench http://127.0.0.1:{port}/web/index.html',flush=True)
 ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()
