import { describe, it, expect } from 'vitest';
import { splitDiffByFile } from '../../src/diff/splitter.js';

describe('Diff Splitter', () => {
  it('should split single file diff', () => {
    const diff = `diff --git a/src/test.ts b/src/test.ts
index 1234567..abcdefg 100644
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,3 +1,4 @@
+console.log('new line');
 function test() {
   return true;
 }`;

    const chunks = splitDiffByFile(diff);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].file).toBe('src/test.ts');
    expect(chunks[0].language).toBe('typescript');
    expect(chunks[0].lineRange).toEqual([1, 4]);
  });

  it('should split multiple file diffs', () => {
    const diff = `diff --git a/src/file1.ts b/src/file1.ts
index 1234567..abcdefg 100644
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,2 +1,3 @@
+new line
 line 1
 line 2
diff --git a/src/file2.js b/src/file2.js
index 7654321..gfedcba 100644
--- a/src/file2.js
+++ b/src/file2.js
@@ -5,3 +5,4 @@
 line 5
 line 6
+new line`;

    const chunks = splitDiffByFile(diff);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].file).toBe('src/file1.ts');
    expect(chunks[0].language).toBe('typescript');
    expect(chunks[1].file).toBe('src/file2.js');
    expect(chunks[1].language).toBe('javascript');
  });

  it('should skip deleted files', () => {
    const diff = `diff --git a/deleted.ts b/deleted.ts
deleted file mode 100644
index 1234567..0000000
--- a/deleted.ts
+++ /dev/null
@@ -1,5 +0,0 @@
-line 1
-line 2
diff --git a/kept.ts b/kept.ts
index abcdefg..1234567 100644
--- a/kept.ts
+++ b/kept.ts
@@ -1,2 +1,3 @@
+new line
 line 1`;

    const chunks = splitDiffByFile(diff);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].file).toBe('kept.ts');
  });

  it('should detect various languages', () => {
    const diff = `diff --git a/test.py b/test.py
index 1234567..abcdefg 100644
--- a/test.py
+++ b/test.py
@@ -1,2 +1,3 @@
+print('hello')
diff --git a/test.go b/test.go
index 1234567..abcdefg 100644
--- a/test.go
+++ b/test.go
@@ -1,2 +1,3 @@
+fmt.Println("hello")`;

    const chunks = splitDiffByFile(diff);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].language).toBe('python');
    expect(chunks[1].language).toBe('go');
  });

  it('should handle empty diff', () => {
    const chunks = splitDiffByFile('');
    expect(chunks).toHaveLength(0);
  });

  it('should parse line ranges correctly', () => {
    const diff = `diff --git a/test.ts b/test.ts
index 1234567..abcdefg 100644
--- a/test.ts
+++ b/test.ts
@@ -10,5 +10,8 @@
 line 10
 line 11
+new line
+new line
+new line`;

    const chunks = splitDiffByFile(diff);

    expect(chunks[0].lineRange).toEqual([10, 17]);
  });

  it('should split multi-hunk diff into separate chunks', () => {
    const diff = `diff --git a/src/test.ts b/src/test.ts
index abc123..def456 100644
--- a/src/test.ts
+++ b/src/test.ts
@@ -10,5 +10,6 @@ function foo() {
   console.log('first hunk');
+  console.log('added line in first hunk');
 }

@@ -50,3 +51,4 @@ function bar() {
   console.log('second hunk');
+  console.log('added line in second hunk');
 }`;

    const chunks = splitDiffByFile(diff);

    // Should create 2 chunks (one per hunk)
    expect(chunks).toHaveLength(2);

    // First chunk
    expect(chunks[0].file).toBe('src/test.ts');
    expect(chunks[0].lineRange).toEqual([10, 15]); // 10 + 6 - 1
    expect(chunks[0].content).toContain('first hunk');
    expect(chunks[0].language).toBe('typescript');

    // Second chunk
    expect(chunks[1].file).toBe('src/test.ts');
    expect(chunks[1].lineRange).toEqual([51, 54]); // 51 + 4 - 1
    expect(chunks[1].content).toContain('second hunk');
    expect(chunks[1].language).toBe('typescript');
  });

  it('should handle three hunks in one file', () => {
    const diff = `diff --git a/file.py b/file.py
--- a/file.py
+++ b/file.py
@@ -1,2 +1,3 @@
 line1
+added1
 line2
@@ -20,1 +21,2 @@
 line20
+added20
@@ -100,3 +102,4 @@
 line100
 line101
+added100
 line102`;

    const chunks = splitDiffByFile(diff);

    expect(chunks).toHaveLength(3);
    expect(chunks[0].lineRange).toEqual([1, 3]);
    expect(chunks[1].lineRange).toEqual([21, 22]);
    expect(chunks[2].lineRange).toEqual([102, 105]);
  });
});
