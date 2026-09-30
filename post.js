// post.js
// Posts the newest item from an RSS feed to Mastodon,
// but only if it hasn't been posted before (no duplicates).

const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const Mastodon = require('mastodon-api');

// --- SETTINGS ---------------------------------------------------
// The RSS feed to watch. Currently a TEMPORARY TEST feed (BBC News).
// CHANGE THIS to your real feed URL later.
const FEED_URL = process.env.FEED_URL || 'https://feeds.bbci.co.uk/news/rss.xml';

// Where we remember the last posted URL (committed back by the Action).
const STATE_FILE = path.join(__dirname, 'state.json');

// Your Mastodon server (your account is on mastodon.social).
const MASTODON_API_URL = 'https://mastodon.social/api/v1/';

// --- HELPERS ----------------------------------------------------
function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { lastPostedUrl: parsed.lastPostedUrl || null };
  } catch (err) {
    return { lastPostedUrl: null };
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

// Wrap the callback-based mastodon-api call in a Promise.
function postStatus(mastodon, text) {
  return new Promise((resolve, reject) => {
    mastodon.post('statuses', { status: text }, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

// --- MAIN -------------------------------------------------------
async function main() {
  const token = process.env.MASTODON_TOKEN;
  if (!token) {
    console.log('No MASTODON_TOKEN found. Nothing to do.');
    return;
  }

  // Read the RSS feed.
  const parser = new Parser();
  let feed;
  try {
    feed = await parser.parseURL(FEED_URL);
  } catch (err) {
    console.log('Could not read the RSS feed:', err.message);
    return; // exit quietly instead of failing the workflow
  }

  if (!feed.items || feed.items.length === 0) {
    console.log('The feed has no items yet. Nothing to post.');
    return;
  }

  // The newest item is normally the first one in the list.
  const latest = feed.items[0];
  const latestUrl = latest.link;

  if (!latestUrl) {
    console.log('Latest feed item has no link. Nothing to post.');
    return;
  }

  // Already posted?
  const state = readState();
  if (state.lastPostedUrl === latestUrl) {
    console.log('Newest item was already posted. Exiting without posting.');
    return;
  }

  // Build the post text (Mastodon allows 500 characters).
  const title = (latest.title || 'New post').trim();
  let text = `${title}\n${latestUrl}`;
  if (text.length > 500) {
    text = text.slice(0, 497) + '...';
  }

  // Send it.
  const mastodon = new Mastodon({
    access_token: token,
    api_url: MASTODON_API_URL,
  });

  try {
    const data = await postStatus(mastodon, text);
    console.log('Posted successfully:', data.url || latestUrl);
  } catch (err) {
    console.log('Failed to post:', err.message || err);
    return; // do NOT save state if the post failed
  }

  // Remember what we posted.
  state.lastPostedUrl = latestUrl;
  writeState(state);
  console.log('Saved state:', latestUrl);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
