# YouTube Keyword Filter for Firefox

This Firefox extension hides desktop YouTube video and channel results whose
visible text, title, or accessibility label contains any whole word entered by
the user in the comma-separated keyword list. The default keyword is `ASMR`.

The in-page switch starts **ON** after every full page load. Turning it off
immediately restores cards hidden by the extension. Its state is retained while
navigating within the same YouTube tab, but it is not saved between reloads.
The extension does not collect or transmit user data.

## Install the extension from the Add-ons Manager
[https://addons.mozilla.org/en-US/firefox/addon/youtube-keyword-filter/](https://addons.mozilla.org/en-US/firefox/addon/youtube-keyword-filter/)

## Install temporarily in Firefox

1. Open `about:debugging`.
2. Select **This Firefox**.
3. Select **Load Temporary Add-on**.
4. Choose this directory's `manifest.json`.
5. Open or reload `https://www.youtube.com/`.

Temporary add-ons are removed when Firefox closes.
