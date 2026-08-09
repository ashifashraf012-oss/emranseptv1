# Meet pre-join screen

A pixel-faithful rebuild of the Google Meet "Ask to join" screen as a single web
page. The camera and microphone are real — they are requested through
`getUserMedia`, the self-view is live, and the microphone drives a level ring
around its button.

**Nothing leaves the page.** There is no `fetch`, no WebSocket, and no
`RTCPeerConnection` anywhere in the file. The camera stream is attached to a
local `<video>` element; the microphone stream is attached to an `AnalyserNode`.
Both are stopped and released the moment you toggle them off, hit back, or leave
the page. It is a UI mock-up, not a calling client.

## Run it

```bash
node server.mjs
```

Then open <http://localhost:4173>.

The tiny server exists for one reason: `getUserMedia` refuses to run on
`file://`. Browsers only expose the camera and microphone on a secure origin,
and `http://localhost` counts as one. Opening `index.html` by double-clicking it
will render correctly but every device toggle will fail.

There is nothing to install — the server uses only Node's standard library.

## What works

| Element | Behaviour |
|---|---|
| Camera button | Real `getUserMedia` on the front camera, live mirrored self-view, avatar fades out |
| Microphone button | Real `getUserMedia`; the button grows a live ring that tracks input level |
| Name | Taken from the joining link, then remembered on the device |
| Avatar | The name's first letter, or a person icon while no name is known |
| Meeting code | Copies `https://meet.google.com/tap-bnhq-jhw` to the clipboard |
| Ask to join | Switches to a spinner and "Asking to join…"; click again to cancel |
| ⋮ menu | Opens, closes on outside click and on `Esc` |
| Companion Mode | Toggles, and releases both devices when switched on |
| Back arrow | Releases camera and microphone, then goes back |
| Drag handle | The sheet follows a downward drag and springs back |

### Whose name is shown

The screen has no sign-in, so the name has to arrive with the link:

```
http://localhost:4173/?name=Rahul%20Ahmed
http://localhost:4173/#name=Rahul%20Ahmed
```

Both forms work. The hash form keeps the name out of server access logs, which
is worth preferring when the link is sent to someone else. Opening a second
invite in the same tab only changes the hash, so a `hashchange` listener picks
that up too.

The name is cleaned before it is used — control characters dropped, whitespace
collapsed, capped at 60 characters — and only ever written through
`textContent`, so a link carrying `<img src=x onerror=…>` renders as literal
text. It is then kept in `localStorage` under `meet-prejoin:name`, so a later
visit without the parameter still knows who is joining. Until a name is known
the tile shows the generic person icon and no label.

This is the name the link says, not a name Google vouched for. Showing a
*verified* account name would mean signing in through Google Identity Services,
which needs a Google Cloud client ID and a real network call — the opposite of
the "nothing leaves the page" property below. Say the word if you want that
version instead.

The page opens with the camera off and the microphone on, matching the
reference. That means it asks for microphone permission on load, exactly as the
real product does. Refusing is handled: the button flips to the muted state and
a toast explains what happened.

Every failure mode is covered rather than left to throw — permission denied,
no device present, device already in use by another app, and a non-secure
origin each produce their own message.

## Deliberate differences from the screenshot

- **No Android status bar or home indicator.** Those belong to the phone, not to
  the page. A web page cannot draw them, and faking them would look wrong inside
  a real browser chrome.
- **No signed-in account chip.** The reference shows the Google account the
  device is signed into. There is no sign-in here, so a hardcoded address would
  have been a picture of a fact rather than the fact itself.
- **On a desktop viewport** the layout is centred in a 420 px column with rounded
  corners instead of being stretched across the window. On a phone it fills the
  screen edge to edge.
- **System fonts.** The original uses Google Sans. Loading it would mean a
  request to `fonts.googleapis.com`, which would break the "nothing leaves the
  page" property, so the stack falls back to Roboto and then the platform UI
  font.

## Layout

Proportions were measured off the reference image and are held as percentages of
the card, not fixed pixels, so the screen keeps its shape at any width:

| | Reference | This page |
|---|---|---|
| Self-view card, share of screen width | 61.7 % | 62 % |
| Card aspect ratio | 1 : 1.82 | 1 : 1.80 |
| Avatar circle, share of card width | 77 % | 77 % |
| Avatar centre, down the card | 37 % | 37 % |
| Control buttons, share of card width | 20 % | 19 % |
| Control row centre, down the card | 79 % | 78.7 % |
| Name centre, down the card | 92 % | 92.1 % |
| Bottom sheet, share of screen height | 28 % | 29 % |
| Join button, share of screen width | 79 % | 79 % |

## Files

```
index.html   the whole page — markup, styles and behaviour
server.mjs   dependency-free static server, only so localhost is a secure origin
```
