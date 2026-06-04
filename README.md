Just a little mp3 streamer. Wanted somethign that worked everywhere. this fit perfectly.

## Photo album + slideshow

The app now supports a mixed media album (photos + videos) on the main card page:

- `Prev Item` and `Next Item` buttons
- `Start Slideshow` / `Stop Slideshow`
- `Open on iPhone` link (opens full image or video in a new tab)
- `Download Item` link

### Recommended media workflow

Use this flow for reliable local + online behavior:

1. Put all slideshow files in `assets/media/`.
2. Keep `card-data.js` for card copy and songs.
3. Let `media-manifest.js` provide the full slideshow file list.

### Add new photos or videos

After adding files to `assets/media/`, regenerate `media-manifest.js`:

```bash
cd /home/kjwagner613/apps/cardAllofMyLove
{
	echo '// Auto-generated from assets/media';
	echo 'window.autoAlbumManifest = [';
	find assets/media -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.gif' -o -iname '*.webp' -o -iname '*.bmp' -o -iname '*.mp4' -o -iname '*.mov' -o -iname '*.m4v' -o -iname '*.webm' -o -iname '*.ogg' \) -printf '%f\n' | LC_ALL=C sort -f | sed 's/.*/  "assets\/media\/&",/';
	echo '];';
} > media-manifest.js
```

Then commit and push updated files.

### Optional: photoAlbum entries in card-data.js

You can keep a few items in `photoAlbum` if you want custom titles/captions.
You do not need to manually list every media file there anymore.

### Example photoAlbum format (optional)

Edit `card-data.js` and update `photoAlbum`.

Example format:

```js
const photoAlbum = [
  {
	 src: "assets/media/photo-01.jpg",
	 title: "Beach Day",
	 caption: "Sunset walk together.",
	 downloadUrl: "assets/media/photo-01.jpg"
	},
	{
		src: "assets/media/memory-clip.mp4",
		title: "Short Video",
		caption: "A small moment worth replaying.",
		type: "video"
  }
];
```

Supported video file extensions for automatic detection: `.mp4`, `.mov`, `.m4v`, `.webm`, `.ogg`

### Note about online hosting

Some hosts do not allow folder listing fetches in production.
That is why `media-manifest.js` is used as the source of truth for full slideshow discovery.

### iPhone behavior

- Tap `Open on iPhone` to open full image size in Safari.
- From there, long-press and choose Save to Photos if desired.
- `Download Photo` behavior depends on iOS/browser rules, so `Open on iPhone` is the most reliable path.
