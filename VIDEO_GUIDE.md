# How to Add Your Training Video

## Step 1 — Upload to YouTube

1. Go to [YouTube Studio](https://studio.youtube.com)
2. Click **Create → Upload video**
3. Upload your training video file
4. Set visibility to **Unlisted** (only people with the link can see it — good for soft launch) or **Public**
5. After upload is complete, copy the **Video ID** from the URL:
   ```
   youtube.com/watch?v=dQw4w9WgXcQ
                        ^^^^^^^^^^^^ this is your Video ID
   ```

---

## Step 2 — Add to index.html

Open `index.html` in any text editor (Notepad, VS Code, etc.)

Search for this line:
```
src="https://www.youtube.com/embed/YOUR_YOUTUBE_VIDEO_ID
```

Replace `YOUR_YOUTUBE_VIDEO_ID` with your actual video ID.

**Example — before:**
```html
src="https://www.youtube.com/embed/YOUR_YOUTUBE_VIDEO_ID?rel=0&modestbranding=1&color=white"
```

**Example — after (using a real video ID):**
```html
src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&color=white"
```

---

## Step 3 — Uncomment the iframe

Find these lines and remove the `<!--` and `-->` comment markers:

**Before (commented out):**
```html
<!--
<iframe
  src="https://www.youtube.com/embed/YOUR_YOUTUBE_VIDEO_ID?..."
  ...
</iframe>
-->
```

**After (uncommented):**
```html
<iframe
  src="https://www.youtube.com/embed/dQw4w9WgXcQ?..."
  title="ChainRoot Сургалт"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen>
</iframe>
```

---

## Step 4 — Remove the placeholder

Find and delete this entire block:
```html
<!-- ▼ DELETE THIS PLACEHOLDER BLOCK WHEN YOU ADD YOUR VIDEO ▼ -->
<div class="tr-video-placeholder" id="trVideoPlaceholder">
  ...
</div>
```

---

## Step 5 — Upload updated index.html to GitHub

1. Go to your GitHub repo
2. Click `index.html` → Edit (pencil icon)
3. Select all, paste the updated code
4. Commit changes

Your video will appear live within 1-2 minutes.

---

## Alternative: Vimeo

If you prefer Vimeo (better quality, no ads):

```html
<iframe 
  src="https://player.vimeo.com/video/YOUR_VIMEO_ID?color=00e87a&title=0&byline=0&portrait=0"
  frameborder="0"
  allow="autoplay; fullscreen; picture-in-picture"
  allowfullscreen>
</iframe>
```

---

## Video Tips for Maximum Conversions

- **Length:** 20-40 minutes is ideal — long enough to be valuable, short enough to watch in one sitting
- **Structure:** Problem → Solution → Demo → CTA (call to action to subscribe)
- **End card:** Always finish with "Subscribe to ChainRoot indicator — link in description"
- **Thumbnail:** Use a clear, readable title in Mongolian with a chart image behind it
- **Title:** "ChainRoot Индикатор - Крипто тэмдгүүдийг хэрхэн унших вэ (Үнэгүй Сургалт)"

---

*Need help? Update this file with your questions and we'll answer them in the next session.*
