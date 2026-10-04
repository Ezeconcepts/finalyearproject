const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const User = require("../models/User");
const { ensureUserKeys } = require("../utils/userKeys");
const { unprotectPrivateKey, encryptFileHybrid, decryptFileHybrid } = require("../utils/crypto");

test("existing keys are retained and incomplete keys are not replaced", async () => {
  const user = { eccPublicKey: "original", eccPrivateKeyEnc: "original-private" };
  assert.equal(await ensureUserKeys(user), user);
  await assert.rejects(ensureUserKeys({ eccPublicKey: "original" }), /incomplete/);
  await assert.rejects(ensureUserKeys({ eccPrivateKeyEnc: "original" }), /incomplete/);
});

test("new account keys are persisted and round-trip file contents", async (t) => {
  const previous = process.env.MASTER_KEY;
  process.env.MASTER_KEY = crypto.randomBytes(32).toString("hex");
  t.after(() => { if (previous === undefined) delete process.env.MASTER_KEY; else process.env.MASTER_KEY = previous; });
  t.mock.method(User, "findOneAndUpdate", (filter, update) => {
    assert.deepEqual(filter.eccPublicKey, { $in: [null, ""] });
    assert.deepEqual(filter.eccPrivateKeyEnc, { $in: [null, ""] });
    return { select: async () => ({ _id: "owner", ...update.$set }) };
  });
  const owner = await ensureUserKeys({ _id: "owner" });
  const data = Buffer.from("download regression");
  const encrypted = encryptFileHybrid(data, owner.eccPublicKey);
  assert.deepEqual(decryptFileHybrid(encrypted, unprotectPrivateKey(owner.eccPrivateKeyEnc)), data);
});

test("concurrent provisioning uses the winning stored keys", async (t) => {
  const previous = process.env.MASTER_KEY;
  process.env.MASTER_KEY = crypto.randomBytes(32).toString("hex");
  t.after(() => { if (previous === undefined) delete process.env.MASTER_KEY; else process.env.MASTER_KEY = previous; });
  const winner = { eccPublicKey: "winner-public", eccPrivateKeyEnc: "winner-private" };
  t.mock.method(User, "findOneAndUpdate", () => ({ select: async () => null }));
  t.mock.method(User, "findById", () => ({ select: async () => winner }));
  assert.equal(await ensureUserKeys({ _id: "owner" }), winner);
});
