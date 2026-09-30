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
    line: "My little cutie, I love you",
    sound: "" // e.g. "assets/audio/inside-joke.mp3"
  },

  /* Passcode to enter the site. Only its hash is stored here; make one with
       node scripts/lock.mjs hash "your passcode"
     Once she's entered it, her device remembers. Set to null to turn it off. */
  gate: {
    question: "What is our favorite librarian:",
    hash: "d09ae3ced0913976a80510860f28db4ccd3b298f58da7fe17a88e56b6fc11562"
  },

  /* Stars can be locked with a question: instead of text, put
       { question: "...", locked: "..." }
     where locked is made with   node scripts/lock.mjs lock "answer" "text"
     (a list of several locked versions accepts several answers; prefix shows
     greyed-out words before her answer). The words are encrypted, so they
     can't be read in the site's files. */
  lockedStars: {
    title: "a locked reason",
    prompt: "this one's just for you. what's the passcode?"
  },

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
    { // locked (original text is in private/locked-stars.txt)
      question: "What's my favorite thing about you",
      prefix: "Your",
      locked: "V95HBENNsFSc9wXfF/mE4U8t7iATxWY6b5Q+i9bfg3L0K9a66UzRBfSC18QRFEkB4xRNU3qOK56No5EVgfCQvsypHuuN+n6uayHlOXD65l6nNzIkuXwiJp9WRndBXg/egorVLlvWZ45GaxrPdqvPmEc0mgPBz5CNdN3rAQ=="
    },
    "You're the first person i want to tell when anything happens, good or bad.",
    "You never make me feel like too much.",
    "You're the first person to make me feel like I matter",
    "You're gentle with me, and with everyone you know. You're so understanding and patient.",
    "Being around you feels like the volume of the world gets turned down.",
    "You check on me without me having to ask.",
    "You make the most boring errands feel like an adventure.",
    "You believe in me on the days I don't.",
    "Remember how you'd sound like everytime you say bro?",
    { // locked (original text is in private/locked-stars.txt); accepts "1" or "one"
      question: "After how many drinks do you get drunk:",
      locked: [
        "gII4XnjpbK6MKBUox+6qOmsSKqccW//LX+4cqDgZWHj2noQ0apxvxKCk4TDIq5wmOcNiQ6XBKvVDklJWOaMsvrXAK6hxmCxvRz0XZBWLlNhgJy6ShumbtA==",
        "x35VGURQ0kiSabzI12AYS8YY9yopwCgT/Umwf/Wx+uWZZLu3qrhlwCvKVeaGfoqHsA0fptzrjIBhxNAkwLgMzdcesGYyWzwV3f5NlvmprcNdlPbdYNKApQ=="
      ]
    }
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
  shootingStar: "You caught a shooting star. Make a wish.",
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
    greeting: "Dear kamy,",
    paragraphs: [
      "How can I even explain to everyone that I met the best person in my whole entire life. You make me feel so cared for and so special. You are the light in every room you walk into, and you always know how to make me smile. Even when the whole world seems like a dark place you know what to say and how to take care of me, as do I when it comes to you. You'll always have me no matter what. I will always be yours Kamy, and you can't get rid of me. You're every star in my night sky whenever I look up. The stars themselves are jealous of you. I love you so much Kamy, and I'll always take care of you.",
      "I made this little place because some things are easier to show than to say.",
      "Every star up there is a reason. every flower is a day you came back. the field is going to keep growing, and so is the list."
    ],
    signoff: "Always,",
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

  /* ---- Cloud shadow theater (tap a cloud) ------------------------------- */
  /* She slides clouds across the moon to make a shadow picture; each one
     comes alive as a tiny scene. The shapes are drawn in js/shadows.js:
     a coffee cup, a little cat, and the two of you. */
  shadows: {
    label: "shadow theater",
    title: "cloud shadow theater",
    intro: "drag the clouds across the moon to make a shadow picture.",
    scenes: [
      { title: "Coffee Time!", caption: "You and your coffee'" },
      { title: "a little cat", caption: "[REPLACE: an inside joke that fits a cat]" },
      { title: "the two of us", caption: "[REPLACE: a favorite memory of you two]" }
    ],
    doneLine: "the moon keeps all our shadows."
  },

  /* ---- Blanket fort (tap the little heart above the two of you) --------- */
  fort: {
    label: "our blanket fort",
    title: "our blanket fort",
    hint: "make it cozy. it'll stay just how you leave it."
  },

  /* ---- Star piano (tap the little music-note stars in the sky) ---------- */
  /* notes go from 0 (lowest) to 7 (highest). She can save her own tune; it
     plays when she opens the site. fromMe is a melody you leave for her. */
  piano: {
    label: "star piano",
    title: "star piano",
    hint: "tap the stars to write a tune (8 notes).",
    fromMe: { notes: [4, 5, 7, 6, 5, 4, 2, 4], line: "someone left a little tune here for you." },
    saved: "saved. it'll play when you arrive."
  },

  /* ---- The secret room -------------------------------------------------- */
  /* Three symbols are hidden: on the cassette, in the letter, and on the
     snack attack victory screen. Entering them at the tiny door in the hill
     opens this room. */
  secretRoom: {
    doorLabel: "a tiny door",
    doorText: "three symbols are hidden around here. enter them in the order you find the numbers.",
    title: "our secret room",
    note: "[REPLACE: something especially personal, just for her]",
    image: "", // optional, e.g. "assets/photos/secret.jpg"
    audio: ""  // optional, e.g. "assets/audio/secret.mp3"
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
  secretsOutro: "okay. now you know all of them.",

  /* ---- A call from the moon (end of "things i never tell you") --------- */
  /* Record short voice clips and save them in assets/audio/call/. Each part
     plays your clip (the text shows as subtitles, and is used on its own if
     the clip is missing), then she picks what to say. A part with no choices
     ends the call. The button only appears once the texts are written. */
  call: {
    button: "the moon is calling...",
    caller: "the moon",
    start: "hello",
    parts: {
      hello: {
        audio: "assets/audio/call/hello.mp3",
        text: "[REPLACE: hey... it's me. are you still up?]",
        choices: [ { say: "i'm up", next: "up" }, { say: "i was asleep...", next: "asleep" } ]
      },
      up: {
        audio: "assets/audio/call/up.mp3",
        text: "[REPLACE: good. i just wanted to hear your voice. did you read everything?]",
        choices: [ { say: "every word", next: "every" }, { say: "why'd you never send them?", next: "why" } ]
      },
      asleep: {
        audio: "assets/audio/call/asleep.mp3",
        text: "[REPLACE: sorry sleepyhead. i'll be quick. i just miss you.]",
        choices: [ { say: "i miss you too", next: "missyou" } ]
      },
      every: { audio: "assets/audio/call/every.mp3", text: "[REPLACE: then you know. goodnight, kamy.]" },
      why: { audio: "assets/audio/call/why.mp3", text: "[REPLACE: because some things are easier to say on a website at 2am. goodnight.]" },
      missyou: { audio: "assets/audio/call/missyou.mp3", text: "[REPLACE: go back to sleep. i'll be here tomorrow. goodnight.]" }
    }
  }
};
