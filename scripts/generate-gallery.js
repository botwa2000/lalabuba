#!/usr/bin/env node
// One-shot batch gallery generation. Run from repo root:
//   node scripts/generate-gallery.js [topic] [difficulty]
// With no args generates 2 images for every topic × difficulty combo (72 total).
// With args generates only the specified slice.
//
// Requires: BLOB_READ_WRITE_TOKEN + IMAGE_PROVIDER env (loads .env automatically).

"use strict";

const path = require("path");

// Load .env
try {
  const fs = require("fs");
  const envText = fs.readFileSync(path.join(__dirname, "../.env"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const gallery = require("../lib/gallery");

let blobPut;
try {
  blobPut = require("@vercel/blob").put;
} catch {
  console.error("@vercel/blob not installed. Run: npm install @vercel/blob");
  process.exit(1);
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN not set in .env");
  process.exit(1);
}

const IMAGES_PER_SLOT = 2; // images to generate per topic+difficulty
const DELAY_MS = 4000;     // delay between requests to avoid rate limiting

const argTopic = process.argv[2]; // optional: specific topic
const argDiff  = process.argv[3]; // optional: specific difficulty

const topics = argTopic && gallery.TOPICS.includes(argTopic)
  ? [argTopic]
  : gallery.TOPICS;

const difficulties = argDiff && gallery.DIFFICULTIES.includes(argDiff)
  ? [argDiff]
  : gallery.DIFFICULTIES;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const total = topics.length * difficulties.length * IMAGES_PER_SLOT;
  console.log(`Generating ${total} images (${topics.length} topics × ${difficulties.length} difficulties × ${IMAGES_PER_SLOT} each)...`);
  console.log(`Topics: ${topics.join(", ")}`);
  console.log(`Difficulties: ${difficulties.join(", ")}\n`);

  let done = 0;
  for (const topic of topics) {
    const meta = gallery.TOPIC_META[topic];
    const subjects = meta.subjects;

    for (const difficulty of difficulties) {
      // Pick subjects for this slot (spread across the list for variety)
      for (let i = 0; i < IMAGES_PER_SLOT; i++) {
        const subject = subjects[(done + i) % subjects.length];
        process.stdout.write(`[${++done}/${total}] ${topic}/${difficulty}: "${subject}" ... `);
        try {
          const { url } = await gallery.generateAndUpload(subject, difficulty, blobPut, `${topic}-${difficulty}`);
          await gallery.addToGallery(topic, difficulty, subject, url);
          console.log("✓");
        } catch (err) {
          console.log(`✗ ${err.message}`);
        }
        if (done < total) await sleep(DELAY_MS);
      }
    }
  }

  console.log("\nDone! Gallery manifest updated at data/gallery.json");
}

main().catch(err => { console.error(err); process.exit(1); });
