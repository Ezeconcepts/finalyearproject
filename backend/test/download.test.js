const test = require("node:test");
const assert = require("node:assert/strict");
const { downloadFilesFromCloud } = require("../controllers/files");

for (const paths of [undefined, "invalid", "null", "[]", '[null]', '[{"fileName":"example.txt"}]', '[{"filePath":" "}]']) {
  test(`rejects invalid download selection: ${paths}`, async () => {
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await downloadFilesFromCloud({ query: { paths } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /select/i);
  });
}
