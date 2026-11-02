// Ticks at the interval it's sent, even while the page is in the background, where a
// page's own timers slow to once a second. FaceOn's video effects draw a frame on each
// tick in browsers that can't process a camera track directly.
let timer;
onmessage = (event) => {
  clearInterval(timer);
  if (event.data > 0) timer = setInterval(() => postMessage(0), event.data);
};
