from google.cloud import storage
from datetime import datetime, timedelta, timezone
from feedgen.feed import FeedGenerator
import feedparser
from typing import Optional
from io import BytesIO
from time import mktime


def update_rss_feed(
    bucket_name: str,
    gcs_path: str,
    title: str,
    link: str,
    description: str,
    pub_date: datetime,
    guid: Optional[str] = None
) -> str:
    """
    Update RSS feed stored in Google Cloud Storage.

    Args:
        gcs_path: Path to RSS file in GCS bucket
        title: Title of new RSS item
        link: Link URL for new item 
        description: Description text for new item
        pub_date: Publication date of new item
        guid: Optional unique ID for new item

    Returns:
        str: GCS path to updated RSS feed
    """
    # Initialize Google Cloud Storage client
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(gcs_path)

    # Create new RSS feed generator
    fg = FeedGenerator()
    fg.title('Goodnumbers')  # TODO: Replace with your site info
    fg.link(href='http://www.foo.com')
    fg.logo(logo="https://storage.googleapis.com/goodnumbersmainassets/assets/goodnumberspodcast.jpg")
    fg.description('GoodNumbers is an experimental weekly personalized podcast about your blood sugar levels. We use non-AI statistical algorithms to analyze your blood sugar levels and creates an AI-generated podcast for you to listen to, discussing your highs, lows, and strategies to address them. Use it for self-reflection, to find your blind spots to your diabetes management, and to continuously improve.')

    if blob.exists():
        # Download and parse existing RSS feed
        content = blob.download_as_bytes()
        current_feed = feedparser.parse(BytesIO(content))

        # Only keep items newer than 10 days
        cutoff_date = datetime.now(
            timezone.utc).astimezone() - timedelta(days=10)

        for item in current_feed.entries:
            # Convert item timestamp to datetime
            item_date = datetime.fromtimestamp(
                timestamp=mktime(item.published_parsed), tz=timezone.utc)

            if item_date > cutoff_date:
                # Add item to new feed if it's recent enough
                fe = fg.add_entry()
                fe.title(item.title)
                fe.link(href=item.link)
                fe.description(item.description)
                fe.published(item_date)
                if hasattr(item, 'guid'):
                    fe.guid(item.guid)

    # Add the new item to feed
    fe = fg.add_entry()
    fe.title(title)
    fe.link(href=link)
    fe.description(description)
    fe.published(pub_date)
    if guid:
        fe.guid(guid)

    # Write feed to memory buffer
    feed_content = BytesIO()
    fg.rss_file(feed_content)
    feed_content.seek(0)  # Reset buffer position to start

    # Upload feed to Google Cloud Storage
    blob.upload_from_file(feed_content, content_type='application/rss+xml')

    return gcs_path
