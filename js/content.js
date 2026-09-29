/* ==========================================================================
   EVERYTHING PERSONAL LIVES IN THIS FILE.
   Edit the text below; you never need to touch the other JS files.
   Anything in [brackets] or marked "REPLACE" is a placeholder.
   ========================================================================== */

window.KAMY = {
  herName: "Kamy",

  /* ---- Supabase (optional) --------------------------------------------- */
  /* Syncs the flower count across all her devices and saves the flowers she
     plants. Paste your Project URL and publishable (or "anon") key from
     Supabase > Project Settings > API. Both are safe to be public.
     Leave them empty and everything is saved in her browser only. */
  supabase: {
    url: "https://eistyxcmdvdgtjrdfnpb.supabase.co",
    key: "sb_publishable_7nTr_cEIvuzstVrzl3jCAw_qx_vAKcN"
  },

  /* ---- Title screen ---------------------------------------------------- */
  title: "why i love kamy",
  subtitle: "a little field of stars, just for you",

  /* Tapping the title heart this many times reveals a tiny inside joke.
     sound is optional: a short clip only she'd recognise (mp3/m4a). */
  titleSecret: {
    taps: 5,
    line: "[REPLACE: an inside joke only kamy will get]",
    sound: "" // e.g. "assets/audio/inside-joke.mp3"
  },

  /* Optional: a question only she knows the answer to, shown before the
     site opens. Set to null to skip. (This is a cute lock, not real
     security: anyone who reads the page source can find the answer.) */
  gate: null,
  // gate: { question: "what do we call the moon?", answer: "our lamp" },

  /* ---- Music ----------------------------------------------------------- */
  /* Drop an mp3 into assets/music/ and put its path here.
     If the file is missing, a built-in 8-bit lullaby plays instead. */
  song: { src: "assets/music/song.mp3", volume: 0.45 },

  /* ---- Flowers --------------------------------------------------------- */
  /* "day"   = one new flower per day she visits (recommended)
     "visit" = one new flower every time she opens the site in a new tab */
  flowers: {
    growOnce: "day",
    /* Shown when a particular flower grows (flower number: message). */
    milestones: {
      1:   "this is the first flower. every day you come back, another one grows.",
      10:  "ten flowers. that's ten days you came to see me. (the heart one is for you.)",
      25:  "twenty-five. the field is starting to look like somewhere.",
      50:  "fifty flowers. i hope you know how much i love that you keep coming back.",
      100: "one hundred. this whole field is just proof of you.",
      365: "a whole year of flowers. a whole year with you"
    },
    alreadyToday: "today's flower is already here. come back tomorrow for another."
  },

  /* ---- Seed packet: she plants her own flower with a note -------------- */
  /* Her flowers stay in the field for good. Click one to read its note.
     With Supabase on, you can also read them all in Table Editor > planted. */
  planting: {
    title: "plant a flower",
    notePrompt: "write a note to tuck inside it",
    button: "choose a spot",
    placeHint: "tap the grass to plant it",
    planted: "planted. your note is tucked inside it now.",
    empty: "write a little something first",
    limit: "that's enough planting for today. the field needs time to grow."
  },

  /* ---- Spaceship in the sky: the minigame ------------------------------ */
  /* She shoots the foods she hates, catches the ones she loves (they heal
     her), then fights the final boss. The foods are drawn in js/game.js. */
  game: {
    title: "snack attack",
    shipLabel: "a little game",
    bossName: "Sofian",
    bossWarning: "a demon approaches...",
    killsToBoss: 24,            // foods to shoot before the boss shows up
    winTitle: "you win!",
    winSubtitle: "sofian has been defeated.",
    winNote: "you were always so strong, and im so proud of you for overcoming the challenges you had to face",
    loseLine: "the vegetables won this round.",
    caughtLine: "yum, {name}!",        // when she catches food she likes
    shotLikedLine: "not the {name}!",  // when she shoots food she likes
    // after she wins, a pineapple-coloured shooting star crosses the field
    victoryStarTitle: "a victory star",
    victoryStar: "a pineapple star, just for the one who beat sofian.",
    // unlocked after beating sofian: stack her favourite foods into a victory snack
    afterpartyButton: "afterparty",
    afterpartyIntro: "catch your favourite foods and stack them as high as you dare.",
    afterpartyTime: 35 // seconds
  },

  /* ---- Stars: one reason per glowing star ------------------------------ */
  /* REPLACE all of these with your own. The number of reasons sets the
     number of glowing stars, so keep it around 8 to 25. */
  reasons: [
    "You were always there for me, and I'll never forget that Kamy",
    "You're such a heavy sleeper, it makes kissing your forehead easy while you sleep",
    "You're the first person i want to tell when anything happens, good or bad.",
    "You never make me feel like too much.",
    "You're the first person to make me feel like I matter",
    "You're gentle with me, and with everyone you know. You're so understanding and patient.",
    "Being around you feels like the volume of the world gets turned down.",
    "You check on me without me having to ask.",
    "You make the most boring errands feel like an adventure.",
    "You believe in me on the days I don't.",
    "Remember how you'd sound like everytime you say bro?",
    "I already miss you falling asleep on my arms"
  ],
  allStarsFound: "you found every star. there are more reasons than stars, but the sky only has so much room.",

  /* Once the heart has formed, tapping the K in the middle reveals this.
     Use any mix: a line (shown in handwriting-style text), a photo of your
     real handwriting, and/or a short recording (played clearly, no effect). */
  kSecret: {
    line: "Oh my pretty girl. I love you Kamy and always will. You'll always have me no matter what.",
    image: "", // e.g. "assets/photos/handwritten.jpg"
    audio: ""  // e.g. "assets/audio/k-note.mp3"
  },

  /* A shooting star crosses the sky now and then. If she catches it she
     can make a wish and seal it away in a small star of its own.
     The wish text is never saved, not even on her phone. Only if she
     ticks "let me read it too" is it sent to you (Supabase > wishes). */
  shootingStar: "you caught a shooting star. make a wish.",
  wish: {
    title: "make a wish",
    placeholder: "type your wish...",
    shareLabel: "let me read it too",
    button: "seal it",
    sealed: "sealed. it's up there now, and only you know what it says.",
    shareFailed: "sealed, but it couldn't be sent. it's still safe up there.",
    starTitle: "your wish",
    starLine: "sealed on {date}. only you know what it says.",
    starLineMany: "{n} wishes sealed here. only you know what they say."
  },

  /* ---- Envelope: the letter -------------------------------------------- */
  letter: {
    greeting: "dear kamy,",
    paragraphs: [
      "How can I even explain to everyone that I met the best person in my whole entire life. You make me feel so cared for and so special. You are the light in every room you walk into, and you always know how to make me smile. Even when the whole world seems like a dark place you know what to say and how to take care of me, as do I when it comes to you. You'll always have me no matter what. I will always be yours Kamy, and you can't get rid of me. You're every star in my night sky whenever I look up. The stars themselves are jealous of you. I love you so much Kamy, and I'll always take care of you.",
      "I made this little place because some things are easier to show than to say.",
      "Every star up there is a reason. every flower is a day you came back. the field is going to keep growing, and so is the list."
    ],
    signoff: "always,",
    signature: "Ahmed"
  },

  /* ---- Paper plane delivery (button at the bottom of the letter) ------- */
  /* place can be: "cafe", "campus", "tower" (eiffel-ish), "lighthouse", "home" */
  plane: {
    button: "fold it into a paper plane",
    title: "paper plane delivery",
    intro: "hold to fly up, let go to glide. three little notes need delivering.",
    deliveries: [
      { place: "cafe", name: "Dunkin!", note: "It's a good thing we'll always have a place to study together" },
      { place: "campus", name: "RIT", note: "The classes, the friends, the drama. I'm glad I shared it all with you" },
      { place: "home", name: "JJ's House", note: "How it feels to be free and silly with you. You make my inner child feel so free" }
    ],
    doneLine: "all three delivered."
  },

  /* ---- Notebook (tap the two silhouettes on the hill) ------------------ */
  /* Her private diary. It's saved only on her device: nobody else can read
     it, including you. She can download a copy any time. */
  notebook: {
    label: "a notebook",
    title: "your notebook",
    placeholder: "write anything. it stays here.",
    privacy: "only you can see this. it lives on this device.",
    empty: "no pages yet."
  },

  /* ---- Firefly rescue (tap the brightest firefly in the field) --------- */
  fireflies: {
    label: "a lost firefly",
    title: "firefly rescue",
    intro: "some fireflies got lost. draw a glowing path to lead them home.",
    doneTitle: "all home.",
    doneLine: "As always, you take care of everything even when you don't have to. You're such a cutie patootie.",
    /* afterwards they gather above the two of you and make this shape for a
       moment: "<3" for a heart, or a few letters/numbers (an inside joke!) */
    finale: "<3"
  },

  /* ---- Headphones: the playlist ---------------------------------------- */
  /* Paste a Spotify, Apple Music, or YouTube playlist link. Spotify/Apple/
     YouTube links are embedded automatically; anything else opens a button. */
  playlist: {
    title: "songs that remind me of you",
    url: "" // e.g. "https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6"
  },

  /* ---- Cassette tape: your voice note ---------------------------------- */
  /* Record a voice memo on your phone, export it as .mp3 or .m4a, and save
     it at the path below. It plays through a cassette effect (tape hiss,
     wobble, warm muffled sound, button clunks). Until the file exists, she
     sees the "missing" line instead. */
  voiceNote: {
    src: "assets/audio/voice-note.mp3",
    title: "a tape for you",
    label: "for kamy · side a",
    missing: "this tape is still being recorded. check back soon."
  },

  /* ---- Camera: photo gallery ------------------------------------------- */
  /* Put photos in assets/photos/ and list them here. JPG/PNG/WebP all work.
     Keep them under about 500 KB each so the site loads fast on her phone. */
  /* The photo marked develop: true starts as a blank polaroid; she rubs it
     with her finger to develop it. Put your most special photo there. */
  filmHint: "rub it gently to develop",
  photos: [
    { src: "assets/photos/01.jpg", caption: "[REPLACE: caption]", develop: true },
    { src: "assets/photos/02.jpg", caption: "[REPLACE: caption]" },
    { src: "assets/photos/03.jpg", caption: "[REPLACE: caption]" },
    { src: "assets/photos/04.jpg", caption: "[REPLACE: caption]" }
  ],

  /* ---- Moon: "things i never tell you" (opens in a new tab) ------------ */
  /* Either write { text, status } or a plain string like "i miss you - deleted".
     Status is the little grey label under the message. */
  secrets: [
    { text: "i miss you", status: "deleted" },
    { text: "you were right. again.", status: "unsent" },
    { text: "when can i see you today again", status: "deleted" },
    { text: "thank you for calling to check on me", status: "draft · 2:14am" },
    { text: "you're my favorite person to do nothing with", status: "deleted" },
    { text: "i'm really proud of you", status: "unsent" },
    { text: "everytime you hug me, it makes letting go harder and harder", status: "deleted" }
  ],
  secretsIntro: "drafts, 2am thoughts, and messages i typed and never sent.",
  secretsSendButton: "send them anyway?",
  secretsOutro: "okay. now you know all of them."
};
