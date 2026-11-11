"""Persistence tests use temporary stores; they never touch user comments."""
import hashlib
import json
from pathlib import Path
import tempfile
from concurrent.futures import ThreadPoolExecutor
import unittest

from annotations import AnnotationError, AnnotationStore


class AnnotationsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.blocks = [{'id': 'abstract', 'align': 'abstract', 'kind': 'abstract', 'tex': 'Original paper.'}]
        self.store = AnnotationStore(self.root, lambda paper: self.blocks)

    def create(self, note_id='test-note-0001', **extras):
        payload = dict(action='save', id=note_id, expected_revision=0, paper='draft',
                       block_id='abstract', body='请把问题说清楚。', quote='原文句子', context_zh='原文段落')
        payload.update(extras)
        return self.store.mutate(payload)

    def test_saved_notes_survive_restart_and_rebuild(self):
        note = self.create()
        restarted = AnnotationStore(self.root, lambda paper: self.blocks)
        self.assertEqual(restarted.snapshot()['comments'][0]['body'], note['body'])
        (self.root / 'index.html').write_text('rebuilt page')
        self.assertEqual(restarted.snapshot()['comments'][0]['id'], note['id'])
        self.assertIn('请把问题说清楚。', (self.root/'annotations/review.md').read_text())

    def test_simultaneous_notes_do_not_replace_each_other(self):
        with ThreadPoolExecutor(max_workers=5) as pool:
            rows=list(pool.map(lambda i:self.create(f'test-note-{i:04d}'),range(20)))
        self.assertEqual(len(self.store.snapshot()['comments']),20)
        self.assertEqual(len({r['id'] for r in rows}),20)

    def test_conflicting_edits_preserve_the_newer_saved_body(self):
        note=self.create()
        self.store.mutate(dict(action='save',id=note['id'],expected_revision=1,body='新意见'))
        with self.assertRaises(AnnotationError) as raised:
            self.store.mutate(dict(action='save',id=note['id'],expected_revision=1,body='过期意见'))
        self.assertEqual(raised.exception.status,409)
        self.assertEqual(self.store.snapshot()['comments'][0]['body'],'新意见')

    def test_retry_after_lost_create_response_is_idempotent(self):
        first=self.create();second=self.create()
        self.assertEqual(first,second)
        self.assertEqual(len(self.store.snapshot()['comments']),1)

    def test_changed_or_removed_paragraph_preserves_original_anchor(self):
        original=self.create()
        self.blocks[0]['tex']='Updated paper.'
        current=self.store.snapshot()['comments'][0]
        self.assertTrue(current['source_changed'])
        self.assertEqual(current['source_tex_at_save'],'Original paper.')
        self.blocks.clear()
        current=self.store.snapshot()['comments'][0]
        self.assertTrue(current['source_missing'])
        self.assertEqual(current['quote'],'原文句子')

    def test_resolve_delete_restore_keep_user_note_and_resolution(self):
        n=self.create()
        n=self.store.mutate(dict(action='status',id=n['id'],expected_revision=1,status='resolved',resolution='已经修改第一句。'))
        n=self.store.mutate(dict(action='delete',id=n['id'],expected_revision=2))
        self.assertEqual(self.store.snapshot()['comments'],[])
        n=self.store.mutate(dict(action='restore',id=n['id'],expected_revision=3))
        self.assertEqual(n['status'],'resolved')
        self.assertEqual(n['resolution'],'已经修改第一句。')
        self.assertEqual(n['body'],'请把问题说清楚。')

    def test_corrupt_file_is_preserved_and_never_replaced_with_empty(self):
        self.create()
        self.store.path.write_text('{broken')
        with self.assertRaises(AnnotationError) as raised:self.create('test-note-0002')
        self.assertEqual(raised.exception.status,503)
        self.assertEqual(self.store.path.read_text(),'{broken')

    def test_whole_paper_note_needs_no_paragraph(self):
        n=self.create(block_id=None,body='统一术语。')
        self.assertEqual(n['section'],'whole')
        self.assertFalse(self.store.snapshot()['comments'][0]['source_missing'])

    def test_invalid_record_does_not_hide_existing_data(self):
        self.create()
        self.store.path.write_text(json.dumps({'schema_version':1,'comments':[None]}))
        with self.assertRaises(AnnotationError):self.store.snapshot()
        self.assertIn('null',self.store.path.read_text())


if __name__=='__main__':unittest.main(verbosity=2)
