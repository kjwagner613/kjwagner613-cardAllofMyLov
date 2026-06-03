Just a little mp3 streamer. Wanted somethign that worked everywhere. this fit perfectly.

## Photo album + slideshow

The app now supports a mixed media album (photos + videos) on the main card page:

- `Prev Photo` and `Next Photo` buttons
- `Start Slideshow` / `Stop Slideshow`
- `Open on iPhone` link (opens full image or video in a new tab)
- `Download Photo` link

### Add your photos

Edit `card-data.js` and update `photoAlbum`.

Example format:

```js
const photoAlbum = [
  {
	 src: "assets/photos/photo-01.jpg",
	 title: "Beach Day",
	 caption: "Sunset walk together.",
	 downloadUrl: "assets/photos/photo-01.jpg"
	},
	{
		src: "assets/photos/memory-clip.mp4",
		title: "Short Video",
		caption: "A small moment worth replaying.",
		type: "video"
  }
];
```

Supported video file extensions for automatic detection: `.mp4`, `.mov`, `.m4v`, `.webm`, `.ogg`

### Photo source options

1. Local files in this project
	- Put images under `assets/` (for example `assets/photos/`).
	- Use the relative path in `src`.

2. Dropbox links
	- Use direct file links when possible.
	- If a link does not render as an image, convert from `www.dropbox.com` share URL to a direct raw URL.

3. MEGA links
	- Use the file URL in `src` if it can be publicly opened.
	- If direct embedding is blocked, users can still use `Open on iPhone` to view it in browser.

### iPhone behavior

- Tap `Open on iPhone` to open full image size in Safari.
- From there, long-press and choose Save to Photos if desired.
- `Download Photo` behavior depends on iOS/browser rules, so `Open on iPhone` is the most reliable path.
