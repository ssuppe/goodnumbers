import { Storage } from '@google-cloud/storage';
import { Feed } from 'feed';
import { Buffer } from 'buffer';

interface UpdateRssFeedParams {
  bucketName: string;
  gcsPath: string;
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  guid?: string;
}

async function updateRssFeed({
  bucketName,
  gcsPath,
  title,
  link,
  description,
  pubDate,
  guid,
}: UpdateRssFeedParams): Promise<string> {
  // Initialize Google Cloud Storage with credentials from env
  const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
  const bucket = storage.bucket(bucketName);
  const blob = bucket.file(gcsPath);

  // Create new feed
  const feed = new Feed({
    id: 'http://www.foo.com',
    title: 'Goodnumbers',
    description: 'GoodNumbers is an experimental weekly personalized podcast...',
    link: 'http://www.foo.com',
    image: 'https://storage.googleapis.com/goodnumbersmainassets/assets/goodnumberspodcast.jpg',
    copyright: 'All rights reserved, Steve Suppe, 2025',
  });

  try {
    // Download existing feed if it exists
    const [exists] = await blob.exists();
    if (exists) {
      const [content] = await blob.download();
      const currentFeed = new Feed(JSON.parse(content.toString()));

      // Filter items newer than 10 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 10);

      currentFeed.items
        .filter((item) => new Date(item.date) > cutoffDate)
        .forEach((item) => {
          feed.addItem({
            title: item.title,
            link: item.link,
            description: item.description,
            date: new Date(item.date),
            guid: item.guid,
          });
        });
    }

    // Add new item
    feed.addItem({
      title,
      link,
      description,
      date: pubDate,
      guid,
    });

    // Generate RSS and upload
    const rssContent = feed.rss2();
    await blob.save(Buffer.from(rssContent), {
      contentType: 'application/rss+xml',
    });

    return gcsPath;
  } catch (error) {
    console.error('Error updating RSS feed:', error);
    throw error;
  }
}

export { updateRssFeed, type UpdateRssFeedParams };
