// Who gets the calendar on /ai-closer. Built from the 41 Closer ICP:
//   the right industry, sales that start on WhatsApp, enough money walking in
//   (volume x ticket), and chats that are real sales work (quotes, bookings,
//   stock checks, orders), not FAQs a cheap bot can answer.
//
// Every submission is saved to Twenty either way. This only decides the NEXT screen:
//   qualified -> pick a demo time now;  not -> "we'll WhatsApp you within one working day".
//
// Thresholds come from our price (build included, from S$1,490/mo on Pro):
//   S$50k/mo enquiry value  ~ enough for ~10% recovered to earn 3x the monthly fee
//   S$100k/mo + real complexity ~ worth a call before anything else in the queue
// The recovery rate is an assumption. Recheck against real leads after ~50 submissions.

(function () {
  var ENQ_PER_WEEK = { under20: 10, '20to50': 35, '50to150': 100, '150plus': 200 };
  var AVG_SALE = { under200: 100, '200to1k': 600, '1kto5k': 3000, '5kplus': 8000 };
  var COMPLEX_JOBS = ['quotes', 'bookings', 'stock', 'orders'];
  var ICP_INDUSTRIES = ['renovation', 'clinic', 'car', 'property', 'education', 'distributor', 'servicing', 'travel', 'retail'];
  var CALL_FLOOR = 50000;
  var PRIORITY_FLOOR = 100000;

  function result(qualified, tier, value, reason) {
    return { qualified: qualified, tier: tier, value: value, reason: reason };
  }

  window.qualify41 = function (answers) {
    var a = answers || {};
    var jobs = Array.isArray(a.jobs) ? a.jobs : [];
    var value = Math.round((ENQ_PER_WEEK[a.enquiries] || 0) * 4.3 * (AVG_SALE[a.saleValue] || 0));
    var complex = jobs.filter(function (j) { return COMPLEX_JOBS.indexOf(j) !== -1; }).length;
    var icp = ICP_INDUSTRIES.indexOf(a.industry) !== -1;
    var bigAndComplex = value >= PRIORITY_FLOOR && complex >= 2;

    if (a.whatsappUse === 'no') {
      return result(false, 'C', value, 'Customers do not usually message on WhatsApp, so the Closer has little to work with');
    }
    if (value < CALL_FLOOR) {
      return result(false, 'C', value, 'Low volume and low value for now');
    }
    if (complex === 0 && value < PRIORITY_FLOOR) {
      return result(false, 'C', value, 'Mostly simple questions, a basic bot may be enough');
    }
    if (!icp) {
      return bigAndComplex
        ? result(true, 'B', value, 'Outside our usual industries, but big enough and complex enough to be worth a look')
        : result(false, 'C', value, 'Industry outside what we usually build for');
    }
    if (bigAndComplex && a.whatsappUse === 'most') {
      return result(true, 'A', value, 'High enquiry value and real sales work in chat. Call this one first');
    }
    return result(true, 'B', value, 'Enough enquiry value for the Closer to pay for itself');
  };
})();
