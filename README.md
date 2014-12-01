# fview-lab

Copyright (c) 2014 by Gadi Cohen
Released under the GPLv3, see LICENSE.txt

FView Lab is a "reatime client-side playground".  It's super useful for rapid
prototyping.  But it's only just half of the full Meteor full-stack
framework.  For a similar project, where you have access to code on the
server too, with custom packages, see [MeteorPad](http://meteorpad.com/).

Designed for use with [famous-views.meteor.com](http://famous-views.meteor.com/).

## Tips and Gotchas

* **When you type**, we try figure out what you're doing to only update
  what's necessary.  That means, typing inside of a `<template>` only affects
  that template, and adjusting `Template.x.rendered/helpers/etc` code will only
  cause a rerender of the affected template.  We never completely reload the
  sandbox, but we don't always get everything right at this early stage.  If necessary, ctrl-R, and if you can reproduce consistently, open an issue.

* **The sandbox only reruns** when all code works.  Look out for the appearance
  of a red cross ("X") at the top of the Templating, Code and Sandboxes for
  problems.  Mousing over will show a tooltip with the error.  In the future, this
  will be integrated into the editors themselves.

* **JS console**.  Chrome by default shows errors from everywhere
  (`Show all messages`) checkbox, and executes code in the `<top frame>`.
  To inspect what's going on inside the sandbox, change the dropdown to
  `<iframe>`.

* **Sharing**.  Any time you save, we mark the webshot as dirty.  When your link is
  first shared, the social network will retrieve the image and cache it.  To
  clear this cache, you should load the link to your page in the appropriate
  debugger for that platform, e.g.
  [Facebook](https://developers.facebook.com/tools/debug/) (click "Fetch new
  scrape information"),
  [Twitter](https://cards-dev.twitter.com/validator),
  ~~[Google+](http://www.google.com/webmasters/tools/richsnippets)~~.
