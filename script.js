document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const requestedPlaylistKey = urlParams.get("playlist");
  const requestedSongIndex = Number.parseInt(urlParams.get("song") ?? "", 10);
  const audioPlayer = document.getElementById("audioPlayer");
  const statusDisplay = document.getElementById("status");
  statusDisplay.textContent = "Paused";
  const currentSongDisplay = document.getElementById("current-song");
  const playlistSelector = document.getElementById("playlist-selector");
  const playlistDisplay = document.getElementById("playlist");
  const trackList = document.getElementById("track-list");
  const trackCount = document.getElementById("track-count");
  const cardTitle = document.getElementById("card-title");
  const cardSubtitle = document.getElementById("card-subtitle");
  const cardNote = document.getElementById("card-note");
  const senderAside = document.getElementById("sender-aside");
  const cardSender = document.getElementById("card-sender");
  const cardRecipient = document.getElementById("card-recipient");
  const transportButtons = document.querySelectorAll("[data-action]");
  const albumPhoto = document.getElementById("album-photo");
  const albumVideo = document.getElementById("album-video");
  const photoStage = document.getElementById("photo-stage");
  const albumCaption = document.getElementById("album-caption");
  const photoCount = document.getElementById("photo-count");
  const photoPrevButton = document.getElementById("photo-prev");
  const photoToggleButton = document.getElementById("photo-toggle");
  const photoNextButton = document.getElementById("photo-next");
  const photoOpenLink = document.getElementById("photo-open");
  const photoDownloadLink = document.getElementById("photo-download");
  const photoPlayButton = document.getElementById("photo-play");

  let currentSongIndex = 0;
  let currentPlaylist = songs; // Default playlist
  let currentPlaylistKey = "songs";
  let currentPlaylistType = 'local'; // 'local' or 'soundcloud'
  let soundcloudWidget = null;
  let currentPhotoIndex = 0;
  let slideshowTimer = null;
  let slideshowActive = false;
  let pendingVideoEndedHandler = null;
  let renderCycle = 0;
  const brokenAlbumIndexes = new Set();

  const slideshowDelayMs = 7000;
  const albumPhotos = Array.isArray(photoAlbum) ? [...photoAlbum] : [];
  const supportedMediaExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif", "mp4", "mov", "m4v", "webm", "ogg"]);
  const mediaDirectory = "assets/media";

  // SoundCloud playlist URLs
  const soundcloudPlaylists = {
    joanneCloud: "https://soundcloud.com/kjwagner613/sets/soundcloud-1",
    kevinCloud: "https://soundcloud.com/kjwagner613/sets/soundcloud-2"
  };

  // Playlist management - declare these first
  const playlists = {
    songs: songs,           // Kevin's Local
    joanneCloud: [],       // Will be populated from SoundCloud
    kevinCloud: []         // Will be populated from SoundCloud
  };

  const playlistNames = {
    songs: "Local",
    joanneCloud: "Joanne's SoundCloud",
    kevinCloud: "Kevin's SoundCloud"
  };

  // Initialize playlist display
  playlistDisplay.textContent = playlistNames.songs; // Set default
  hydrateCardCopy();
  renderTrackList();

  function getFirstPlayableIndex(playlist) {
    for (let index = 0; index < playlist.length; index += 1) {
      if (playlist[index].play) {
        return index;
      }
    }
    return 0;
  }

  // Handle playlist selection
  if (playlistSelector) {
    playlistSelector.addEventListener('change', function () {
      const selectedPlaylist = this.value;
      currentPlaylistKey = selectedPlaylist;
      playlistDisplay.textContent = playlistNames[selectedPlaylist];

      if (selectedPlaylist === 'joanneCloud' || selectedPlaylist === 'kevinCloud') {
        // Switch to SoundCloud mode
        switchToSoundCloud(selectedPlaylist);
      } else {
        // Switch to local mode
        switchToLocal(selectedPlaylist);
      }
      renderTrackList();
    });
  }

  function hydrateCardCopy() {
    if (typeof cardConfig === "undefined") return;
    cardTitle.textContent = cardConfig.title || cardTitle.textContent;
    cardSubtitle.textContent = cardConfig.subtitle || cardSubtitle.textContent;
    cardNote.textContent = cardConfig.note || cardNote.textContent;
    if (senderAside) {
      if (cardConfig.senderAsideHtml) {
        senderAside.innerHTML = cardConfig.senderAsideHtml;
        senderAside.hidden = false;
      } else {
        senderAside.innerHTML = "";
        senderAside.hidden = true;
      }
    }
    cardSender.textContent = cardConfig.sender || cardSender.textContent;
    cardRecipient.textContent = cardConfig.recipient || cardRecipient.textContent;
  }

  function enforceFreshCardState() {
    hydrateCardCopy();

    const hasExplicitSongSelection = Number.isInteger(requestedSongIndex)
      && requestedSongIndex >= 0
      && requestedSongIndex < playlists.songs.length;

    if (hasExplicitSongSelection || currentPlaylistType !== "local") {
      return;
    }

    const firstPlayableIndex = getFirstPlayableIndex(playlists.songs);
    const expectedSong = playlists.songs[firstPlayableIndex];
    const currentSong = currentPlaylist[currentSongIndex];
    const shouldResetToDefaultSong = currentPlaylist !== playlists.songs
      || currentSongIndex !== firstPlayableIndex
      || !currentSong
      || currentSong.file !== expectedSong.file;

    if (playlistSelector) {
      playlistSelector.value = "songs";
    }
    currentPlaylistKey = "songs";
    playlistDisplay.textContent = playlistNames.songs;
    currentPlaylist = playlists.songs;

    if (shouldResetToDefaultSong) {
      playSong(firstPlayableIndex, false);
    } else {
      renderTrackList();
    }
  }

  function renderTrackList() {
    if (!trackList || !trackCount) return;

    if (currentPlaylistType === "soundcloud") {
      trackCount.textContent = "Streaming";
      trackList.innerHTML = `
        <div class="track-item">
          <div class="track-number">SC</div>
          <div class="track-meta">
            <strong>${playlistNames[currentPlaylistKey]}</strong>
            <span>Use the player controls to browse the SoundCloud set.</span>
          </div>
        </div>
      `;
      return;
    }

    trackCount.textContent = `${currentPlaylist.length} song${currentPlaylist.length === 1 ? "" : "s"}`;
    trackList.innerHTML = "";

    currentPlaylist.forEach((song, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `track-item${index === currentSongIndex ? " is-active" : ""}`;
      item.innerHTML = `
        <span class="track-number">${index + 1}</span>
        <span class="track-meta">
          <strong>${song.name}</strong>
          <span>${song.artist}</span>
        </span>
      `;
      item.addEventListener("click", () => {
        playSong(index);
      });
      trackList.appendChild(item);
    });
  }

  function normalizePhotoItem(photo, index) {
    if (typeof photo === "string") {
      return {
        src: photo,
        title: `Photo ${index + 1}`,
        caption: "",
        type: detectMediaType(photo)
      };
    }

    return {
      src: photo.src || "",
      title: photo.title || `Photo ${index + 1}`,
      caption: photo.caption || "",
      downloadUrl: photo.downloadUrl || "",
      poster: photo.poster || "",
      type: detectMediaType(photo.src || "", photo.type || photo.mediaType || "")
    };
  }

  function detectMediaType(src, explicitType = "") {
    const cleanExplicitType = String(explicitType).toLowerCase();
    if (cleanExplicitType.startsWith("video")) return "video";
    if (cleanExplicitType.startsWith("image")) return "image";

    const cleanSrc = String(src).split("?")[0].toLowerCase();
    if (cleanSrc.endsWith(".mp4") || cleanSrc.endsWith(".mov") || cleanSrc.endsWith(".m4v") || cleanSrc.endsWith(".webm") || cleanSrc.endsWith(".ogg")) {
      return "video";
    }

    return "image";
  }

  function isSupportedMediaPath(src) {
    const cleanSrc = String(src).split("?")[0].split("#")[0].toLowerCase();
    const extension = cleanSrc.includes(".") ? cleanSrc.slice(cleanSrc.lastIndexOf(".") + 1) : "";
    return supportedMediaExtensions.has(extension);
  }

  function normalizeAssetPath(href) {
    const cleanHref = String(href || "").trim();
    if (!cleanHref || cleanHref.startsWith("#")) return "";
    if (cleanHref.startsWith("../") || cleanHref.startsWith("./../")) return "";
    if (cleanHref.endsWith("/")) return "";

    let decoded = cleanHref;
    try {
      decoded = decodeURIComponent(cleanHref);
    } catch (_error) {
      decoded = cleanHref;
    }

    if (/^https?:\/\//i.test(decoded)) {
      try {
        decoded = new URL(decoded).pathname;
      } catch (_error) {
        return "";
      }
    }

    const withoutQuery = decoded.split("?")[0].split("#")[0];
    if (!withoutQuery) return "";

    if (withoutQuery.startsWith(`${mediaDirectory}/`)) {
      return withoutQuery;
    }

    if (withoutQuery.startsWith(`/${mediaDirectory}/`)) {
      return withoutQuery.slice(1);
    }

    if (withoutQuery.startsWith("assets/")) {
      const tail = withoutQuery.slice("assets/".length);
      return `${mediaDirectory}/${tail.replace(/^media\//, "")}`;
    }

    return `${mediaDirectory}/${withoutQuery.replace(/^\.?\//, "")}`;
  }

  async function extendAlbumFromAssetsDirectory() {
    try {
      const discoveredPaths = new Set();

      const candidateUrls = [
        `${mediaDirectory}/`,
        `${mediaDirectory}`,
        `./${mediaDirectory}/`,
        `./${mediaDirectory}`
      ];

      for (const url of candidateUrls) {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          continue;
        }

        const directoryHtml = await response.text();
        if (!directoryHtml.trim()) {
          continue;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(directoryHtml, "text/html");
        const links = Array.from(doc.querySelectorAll("a"));

        links.forEach((link) => {
          const assetPath = normalizeAssetPath(link.getAttribute("href") || "");
          if (!assetPath || !isSupportedMediaPath(assetPath)) return;
          discoveredPaths.add(assetPath);
        });

        const mediaNamePattern = /(?:^|[\s"'=/])(?!\.{1,2}\/)([^\s"'<>]+\.(?:jpe?g|png|gif|webp|bmp|mp4|mov|m4v|webm|ogg))(?=$|[\s"'<>?#])/gi;
        let match = mediaNamePattern.exec(directoryHtml);
        while (match) {
          const rawName = (match[1] || "").trim();
          const assetPath = normalizeAssetPath(rawName);
          if (assetPath && isSupportedMediaPath(assetPath)) {
            discoveredPaths.add(assetPath);
          }
          match = mediaNamePattern.exec(directoryHtml);
        }

        if (discoveredPaths.size) {
          break;
        }
      }

      if (!discoveredPaths.size) return;

      const existing = new Set(
        albumPhotos
          .map((entry, index) => normalizePhotoItem(entry, index).src)
          .map((src) => String(src).toLowerCase())
      );

      const discovered = [];
      discoveredPaths.forEach((assetPath) => {
        if (existing.has(assetPath.toLowerCase())) return;

        existing.add(assetPath.toLowerCase());
        const filename = assetPath.split("/").pop() || assetPath;
        const title = filename.replace(/\.[^/.]+$/, "");

        discovered.push({
          src: assetPath,
          title,
          caption: "",
          type: detectMediaType(assetPath)
        });
      });

      if (!discovered.length) return;

      albumPhotos.push(...discovered);
      renderPhoto(currentPhotoIndex);
    } catch (_error) {
      // Some static servers do not expose directory listings. Fallback silently.
    }
  }

  function updatePhotoUiForMissingAlbum() {
    if (!albumPhoto || !albumCaption || !photoCount) return;

    photoCount.textContent = "0 items";
    albumPhoto.removeAttribute("src");
    albumPhoto.style.display = "none";
    if (albumVideo) {
      albumVideo.pause();
      albumVideo.removeAttribute("src");
      albumVideo.removeAttribute("poster");
      albumVideo.load();
      albumVideo.style.display = "none";
    }
    albumCaption.textContent = "Add photos or videos in card-data.js to start your slideshow.";
    if (photoStage) {
      photoStage.dataset.orientation = "landscape";
      photoStage.dataset.mediaType = "image";
    }

    [photoPrevButton, photoToggleButton, photoNextButton].forEach((button) => {
      if (button) button.disabled = true;
    });

    if (photoOpenLink) {
      photoOpenLink.classList.add("is-disabled");
      photoOpenLink.href = "#";
    }

    if (photoDownloadLink) {
      photoDownloadLink.classList.add("is-disabled");
      photoDownloadLink.href = "#";
      photoDownloadLink.removeAttribute("download");
    }

    if (photoPlayButton) {
      photoPlayButton.textContent = "Play";
      photoPlayButton.disabled = false;
    }
  }

  function updatePhotoUiForNoLoadableItems() {
    updatePhotoUiForMissingAlbum();
    if (albumCaption) {
      albumCaption.textContent = "No loadable media found yet. Add/move files into assets and refresh.";
    }
  }

  function applyMediaOrientation(width, height, mediaType) {
    if (!photoStage) return;
    const safeWidth = Number(width) || 1;
    const safeHeight = Number(height) || 1;
    const orientation = safeHeight > safeWidth ? "portrait" : "landscape";
    photoStage.dataset.orientation = orientation;
    photoStage.dataset.mediaType = mediaType;
  }

  function clearSlideshowTimer() {
    if (slideshowTimer) {
      window.clearTimeout(slideshowTimer);
      slideshowTimer = null;
    }
  }

  function clearPendingVideoEndedHandler() {
    if (albumVideo && pendingVideoEndedHandler) {
      albumVideo.removeEventListener("ended", pendingVideoEndedHandler);
      pendingVideoEndedHandler = null;
    }
  }

  function armSlideshowForCurrentItem() {
    clearSlideshowTimer();
    clearPendingVideoEndedHandler();

    if (!slideshowActive || !albumPhotos.length) return;

    const currentItem = normalizePhotoItem(albumPhotos[currentPhotoIndex], currentPhotoIndex);
    const isVideoVisible = albumVideo && albumVideo.style.display !== "none";

    if (currentItem.type === "video" && isVideoVisible) {
      pendingVideoEndedHandler = () => {
        pendingVideoEndedHandler = null;
        if (slideshowActive) {
          showNextPhoto();
        }
      };
      albumVideo.addEventListener("ended", pendingVideoEndedHandler, { once: true });
      albumVideo.play().catch(() => {
        // If autoplay is blocked, use fallback so slideshow does not freeze.
        slideshowTimer = window.setTimeout(showNextPhoto, slideshowDelayMs);
      });
      return;
    }

    slideshowTimer = window.setTimeout(showNextPhoto, slideshowDelayMs);
  }

  function renderPhoto(index, attempts = 0) {
    if (!albumPhotos.length || !albumPhoto || !albumCaption || !photoCount) {
      updatePhotoUiForMissingAlbum();
      return;
    }

    if (attempts >= albumPhotos.length) {
      updatePhotoUiForNoLoadableItems();
      return;
    }

    const safeIndex = (index + albumPhotos.length) % albumPhotos.length;
    if (brokenAlbumIndexes.has(safeIndex)) {
      renderPhoto(index + 1, attempts + 1);
      return;
    }

    renderCycle += 1;
    const thisRenderCycle = renderCycle;
    const photo = normalizePhotoItem(albumPhotos[safeIndex], safeIndex);
    currentPhotoIndex = safeIndex;

    if (!photo.src) {
      updatePhotoUiForMissingAlbum();
      return;
    }

    if (photo.type === "video" && albumVideo) {
      albumPhoto.style.display = "none";
      albumPhoto.removeAttribute("src");

      albumVideo.style.display = "block";
      albumVideo.onerror = () => {
        if (thisRenderCycle !== renderCycle) return;
        brokenAlbumIndexes.add(safeIndex);
        renderPhoto(index + 1, attempts + 1);
      };
      albumVideo.src = photo.src;
      albumVideo.playsInline = true;
      albumVideo.muted = true;
      applyMediaOrientation(16, 9, "video");
      albumVideo.onloadedmetadata = () => {
        brokenAlbumIndexes.delete(safeIndex);
        applyMediaOrientation(albumVideo.videoWidth, albumVideo.videoHeight, "video");
      };
      if (photo.poster) {
        albumVideo.poster = photo.poster;
      } else {
        albumVideo.removeAttribute("poster");
      }
      albumVideo.load();

      if (slideshowActive) {
        albumVideo.play().catch(() => {
          // Autoplay can be blocked in some mobile browsers.
        });
      }
    } else {
      if (albumVideo) {
        albumVideo.pause();
        albumVideo.onerror = null;
        albumVideo.removeAttribute("src");
        albumVideo.removeAttribute("poster");
        albumVideo.load();
        albumVideo.style.display = "none";
      }

      albumPhoto.style.display = "block";
      albumPhoto.onerror = () => {
        if (thisRenderCycle !== renderCycle) return;
        brokenAlbumIndexes.add(safeIndex);
        renderPhoto(index + 1, attempts + 1);
      };
      applyMediaOrientation(16, 9, "image");
      albumPhoto.src = photo.src;
      albumPhoto.alt = photo.title;
      albumPhoto.onload = () => {
        brokenAlbumIndexes.delete(safeIndex);
        applyMediaOrientation(albumPhoto.naturalWidth, albumPhoto.naturalHeight, "image");
      };
      if (albumPhoto.complete && albumPhoto.naturalWidth > 0) {
        brokenAlbumIndexes.delete(safeIndex);
        applyMediaOrientation(albumPhoto.naturalWidth, albumPhoto.naturalHeight, "image");
      }
    }

    albumCaption.textContent = photo.caption ? `${photo.title} - ${photo.caption}` : photo.title;
    photoCount.textContent = `${safeIndex + 1} of ${albumPhotos.length}`;

    if (photoOpenLink) {
      photoOpenLink.classList.remove("is-disabled");
      photoOpenLink.href = photo.src;
    }

    if (photoDownloadLink) {
      const downloadHref = photo.downloadUrl || photo.src;
      photoDownloadLink.classList.remove("is-disabled");
      photoDownloadLink.href = downloadHref;
      photoDownloadLink.setAttribute("download", photo.title || `photo-${safeIndex + 1}`);
    }

    [photoPrevButton, photoToggleButton, photoNextButton].forEach((button) => {
      if (button) button.disabled = false;
    });

    if (slideshowActive) {
      armSlideshowForCurrentItem();
    }
  }

  function showNextPhoto() {
    renderPhoto(currentPhotoIndex + 1);
  }

  function showPrevPhoto() {
    renderPhoto(currentPhotoIndex - 1);
  }

  function stopSlideshow() {
    slideshowActive = false;
    clearSlideshowTimer();
    clearPendingVideoEndedHandler();
    if (albumVideo) {
      albumVideo.pause();
    }
    if (photoToggleButton) {
      photoToggleButton.textContent = "Start Slideshow";
    }
  }

  function startSlideshow() {
    if (!albumPhotos.length || slideshowActive) return;
    slideshowActive = true;
    armSlideshowForCurrentItem();
    if (photoToggleButton) {
      photoToggleButton.textContent = "Stop Slideshow";
    }
  }

  function toggleSlideshow() {
    if (slideshowActive) {
      stopSlideshow();
    } else {
      startSlideshow();
    }
  }

  function switchToLocal(playlistKey) {
    currentPlaylistKey = playlistKey;
    currentPlaylistType = 'local';
    currentPlaylist = playlists[playlistKey];
    currentSongIndex = 0;

    // Stop SoundCloud player if it's playing
    if (soundcloudWidget) {
      soundcloudWidget.pause();
    }

    // Hide SoundCloud widget, show audio player
    document.getElementById('soundcloud-container').style.display = 'none';
    document.getElementById('audioPlayer').style.display = 'block';

    const firstPlayableIndex = getFirstPlayableIndex(currentPlaylist);

    // Load the first song but don't auto-play
    playSong(firstPlayableIndex, false);
    renderTrackList();
  }

  function switchToSoundCloud(playlistKey) {
    currentPlaylistKey = playlistKey;
    currentPlaylistType = 'soundcloud';
    currentSongIndex = 0;

    // Stop and pause the local audio player
    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.pause();
    audioPlayer.currentTime = 0;

    // Hide audio player, show SoundCloud widget
    const soundcloudContainer = document.getElementById('soundcloud-container');

    audioPlayer.style.display = 'none';
    soundcloudContainer.style.display = 'block';
    soundcloudContainer.style.width = '100%';
    soundcloudContainer.style.height = '166px';

    // Load SoundCloud playlist
    const playlistUrl = soundcloudPlaylists[playlistKey];
    const widgetUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(playlistUrl)}&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;

    const iframe = document.getElementById('soundcloud-widget');
    iframe.src = widgetUrl;

    // Check if SC (SoundCloud) is available
    if (typeof SC === 'undefined') {
      statusDisplay.textContent = "SoundCloud API Error";
      currentSongDisplay.innerHTML = "SoundCloud API not loaded";
      return;
    }

    // Initialize SoundCloud widget
    soundcloudWidget = SC.Widget(iframe);
    soundcloudWidget.bind(SC.Widget.Events.READY, function () {
      updateStatusForSoundCloud();
      renderTrackList();
    });

    soundcloudWidget.bind(SC.Widget.Events.PLAY, function () {
      updateStatusForSoundCloud("Playing");
    });

    soundcloudWidget.bind(SC.Widget.Events.PAUSE, function () {
      updateStatusForSoundCloud("Paused");
    });
  }

  function updateStatusForSoundCloud(status = "Ready") {
    if (soundcloudWidget) {
      soundcloudWidget.getCurrentSound(function (currentSound) {
        if (currentSound) {
          statusDisplay.textContent = status;
          currentSongDisplay.innerHTML = `${currentSound.title}<br>${currentSound.user.username}`;
        } else {
          statusDisplay.textContent = status;
          currentSongDisplay.innerHTML = "SoundCloud Playlist";
        }
      });
    }
  }

  transportButtons.forEach(button => {
    button.addEventListener('click', function () {
      const action = this.getAttribute('data-action');

      if (currentPlaylistType === 'soundcloud' && soundcloudWidget) {
        switch (action) {
          case 'prev':
            soundcloudWidget.prev();
            break;
          case 'play':
            soundcloudWidget.play();
            break;
          case 'pause':
            soundcloudWidget.pause();
            break;
          case 'next':
            soundcloudWidget.next();
            break;
          default:
            console.warn('Unknown action:', action);
        }
      } else {
        switch (action) {
          case 'prev':
            playPrevSong();
            break;
          case 'play':
            audioPlayer.play();
            break;
          case 'pause':
            audioPlayer.pause();
            break;
          case 'next':
            playNextSong();
            break;
          default:
            console.warn('Unknown action:', action);
        }
      }
    });
  });



  function playSong(index, autoPlay = true) {
    audioPlayer.src = currentPlaylist[index].file;
    if (autoPlay) {
      audioPlayer.play().catch((error) => {
        console.error("Error playing song:", error);
      });
      updateStatus("Playing", currentPlaylist[index].name);
    } else {
      audioPlayer.load();
      updateStatus("Paused", currentPlaylist[index].name);
    }
    currentSongIndex = index;
    renderTrackList();
  }

  function updateStatus(status, songName) {
    statusDisplay.textContent = status;
    const currentSong = currentPlaylist[currentSongIndex];
    currentSongDisplay.innerHTML = `${currentSong.name}<br>${currentSong.artist}`;
  }

  audioPlayer.addEventListener("ended", () => {
    playNextSong();
  });

  audioPlayer.addEventListener("play", () => {
    updateStatus("Playing", currentPlaylist[currentSongIndex].name);
  });
  audioPlayer.addEventListener("pause", () => {
    updateStatus("Paused", currentPlaylist[currentSongIndex].name);
  });

  function playNextSong() {
    let nextIndex = currentSongIndex;
    let found = false;
    for (let i = 0; i < currentPlaylist.length; i++) {
      nextIndex = (nextIndex + 1) % currentPlaylist.length;
      if (currentPlaylist[nextIndex].play) {
        found = true;
        break;
      }
    }
    if (found) {
      playSong(nextIndex);
    } else {
      updateStatus("No songs selected to play", "");
      audioPlayer.pause();
    }
  }



  function playPrevSong() {
    let prevIndex = currentSongIndex;
    let found = false;
    for (let i = 0; i < currentPlaylist.length; i++) {
      prevIndex = (prevIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
      if (currentPlaylist[prevIndex].play) {
        found = true;
        break;
      }
    }
    if (found) {
      playSong(prevIndex);
    } else {
      updateStatus("No songs selected to play", "");
      audioPlayer.pause();
    }
  }

  if (requestedPlaylistKey && playlists[requestedPlaylistKey]) {
    currentPlaylistKey = requestedPlaylistKey;
    currentPlaylist = playlists[requestedPlaylistKey];
    if (playlistSelector) {
      playlistSelector.value = requestedPlaylistKey;
    }
    playlistDisplay.textContent = playlistNames[requestedPlaylistKey];
  }

  if (Number.isInteger(requestedSongIndex) && requestedSongIndex >= 0 && requestedSongIndex < currentPlaylist.length) {
    playSong(requestedSongIndex);
    urlParams.delete("playlist");
    urlParams.delete("song");
    const cleanQuery = urlParams.toString();
    const cleanUrl = cleanQuery ? `${window.location.pathname}?${cleanQuery}` : window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
  } else {
    playSong(getFirstPlayableIndex(currentPlaylist), false);
  }

  window.addEventListener("load", enforceFreshCardState);
  window.setTimeout(enforceFreshCardState, 300);

  if (photoPrevButton) {
    photoPrevButton.addEventListener("click", () => {
      showPrevPhoto();
    });
  }

  if (photoNextButton) {
    photoNextButton.addEventListener("click", () => {
      showNextPhoto();
    });
  }

  if (photoToggleButton) {
    photoToggleButton.addEventListener("click", () => {
      toggleSlideshow();
    });
  }

  if (photoPlayButton) {
    photoPlayButton.addEventListener("click", () => {
      if (currentPlaylistType === "soundcloud" && soundcloudWidget) {
        soundcloudWidget.play();
      } else {
        audioPlayer.play().catch(() => {
          // Playback can be blocked if the browser requires direct user interaction.
        });
      }
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopSlideshow();
    }
  });

  renderPhoto(0);
  extendAlbumFromAssetsDirectory();

  function syncBottomImageHeight() {
    const bottomImage = document.getElementById('pic80s');
    if (!bottomImage) return;
    bottomImage.style.height = '74px';
    bottomImage.style.width = '74px';
  }

  // Call on load and resize
  syncBottomImageHeight();
  window.addEventListener('resize', syncBottomImageHeight);
});
