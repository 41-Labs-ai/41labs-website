// Who gets the calendar on /ai-closer.
//
// Every form submission is saved to Twenty either way. This only decides the
// NEXT screen:
//   true  -> they pick a call time straight away (costs you a 20-min call)
//   false -> "we'll WhatsApp you within one working day" (you triage first)
//
// The numbers model (41 Labs/41-CLOSER-NUMBERS.md) needs 20 held calls a month
// for 4 closes at a 20% close rate. Too loose and you burn calls on people who
// can't buy. Too tight and you starve the calendar.
//
// answers = {
//   enquiries: 'under20' | '20to50' | '50to150' | '150plus'   // WhatsApp enquiries a WEEK
//   saleValue: 'under200' | '200to1k' | '1kto5k' | '5kplus'   // average sale, S$
//   role:      'owner' | 'sales_head' | 'manager' | 'other'
// }
window.qualify41 = function (answers) {
  // TODO(Alexander): decide who is worth a call. Until this is written,
  // everyone sees the calendar.
  return true;
};
