// Run window.runBrowserModerationRegression() in the standalone harness page.
export async function runBrowserModerationRegression() {
  const checks = [];
  const h = window.__moderationHarness;
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const check = (name, condition) => { if (!condition) throw new Error(name); checks.push(name); };
  const input = () => document.querySelector('input[placeholder="Type a message..."]');
  const button = (text) => [...document.querySelectorAll("button")].find((element) => element.textContent === text);
  const type = (value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input(), value);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  };
  await wait(50);
  check("active participant can compose", !input().disabled);
  type("Synthetic new message"); await wait(50);
  button("Send").click(); await wait(50);
  check("active participant can send", h.sends === 1);
  h.readOnly = true;
  await wait(4300);
  check("existing composer freezes after moderation", input().disabled);
  check("assignment mutations freeze", button("Request Cancellation").matches(":disabled"));
  check("review mutation freezes", button("Submit Review").disabled);
  check("historical messages remain readable", document.body.innerText.includes("Historical message remains"));
  button("Historical two · Review").click(); await wait(50);
  check("historical assignment selection stays enabled", document.body.innerText.includes("Historical two\n\nPreserved historical assignment"));
  check("read-only policy is explained", document.body.innerText.includes("read-only because a counterpart account is unavailable"));
  type("Attempted bypass"); await wait(50);
  input().closest("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  button("Request Cancellation").click(); button("Submit Review").click(); await wait(50);
  check("disabled controls and direct submit cannot mutate", h.sends === 1 && h.writes === 0);
  h.readOnly = false;
  await wait(4300);
  check("unblocking restores legitimate active controls", !input().disabled && !button("Request Cancellation").matches(":disabled"));
  h.offline = true;
  await wait(4300);
  check("access-check failure disables mutations", input().disabled && button("Request Cancellation").matches(":disabled"));
  return { passed: checks.length, checks };
}
