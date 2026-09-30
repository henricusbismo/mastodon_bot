const Mastodon = require('mastodon-api');

const M = new Mastodon({
  access_token: process.env.MASTODON_TOKEN,
  api_url: `${process.env.MASTODON_URL}/api/v1/`,
});

const status = `Hello from my bot! Posted at ${new Date().toISOString()}`;

M.post('statuses', { status }, (err, data) => {
  if (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
  console.log('Posted:', data.url);
});
