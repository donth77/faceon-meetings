# Desktop app: checks by hand

For each release, on a Mac (Apple silicon, and Intel if you can) and a Windows 11 PC.
Note the version and the system for each run.

## Install and first run

- [ ] The installer opens without a warning (signed builds), or with the expected one (unsigned).
- [ ] The app opens on Home, at a sensible size; quitting and reopening keeps the size and place.
- [ ] macOS: the camera and microphone prompts appear on first use; screen sharing asks for Screen Recording and works after reopening the app.

## Signing in

- [ ] Email and password sign-in works inside the window.
- [ ] Google: the browser opens, signs in, asks "Continue as …", and the app is signed in.
- [ ] GitHub, the same.
- [ ] Signing out in the app leaves the browser signed in.

## Links

- [ ] Signed out, the app opens on its first screen (join, sign in, create an account), with no scrolling; signed in, on Home.
- [ ] Continue with Google: wait a few minutes at the browser's "Open FaceOn?" before allowing it, and the app still signs in.
- [ ] `pnpm desktop:try`: FaceOn's name and icon in the title bar, the taskbar or Dock and the tray, and browsers ask "Open FaceOn?".
- [ ] Settings → Desktop app → Open browser settings opens Settings → General in the browser, with "Open meeting links in the desktop app".
- [ ] A `faceon://j/<id>` link from a browser opens the meeting in the app.
- [ ] The join page's "Open in the FaceOn app" opens it, passcode included.
- [ ] A link while a meeting is on asks before leaving it.
- [ ] Other sites' links open in the default browser; the window stays put.

## In a meeting

- [ ] The tray or menu bar shows Mute or Unmute and Leave, and both work.
- [ ] The mute shortcut (Ctrl+Shift+A or ⌘⇧A) works while another app is in front, and does nothing outside meetings.
- [ ] Share screen shows the app's picker (Windows, macOS 14 and earlier) or the system's (macOS 15+); a window shares, and on Windows "Share sound from this computer" shares its sound.
- [ ] Picture-in-picture stays on top of other apps.
- [ ] Unread chat shows on the dock or taskbar, and clears.

## Without a window

- [ ] Closing the window keeps the app in the tray or menu bar; with **Keep FaceOn in the tray** (menu bar) off, it quits.
- [ ] A reminder arrives for a meeting starting soon, with the window closed; Join opens it.
- [ ] Launch at login, turned on, opens the app at the next sign-in to the computer.

## Updates

- [ ] With an older version installed, the app finds the new one, downloads it, and installs on restart (Windows; macOS when signed).
- [ ] Unsigned Mac: it says the new version is out and links to the download.
- [ ] Uninstalling removes the app; reinstalling keeps you signed in only if the app's data was kept.
