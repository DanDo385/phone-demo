// Static, labeled demonstration of one fictional roofing inquiry.
// Figures are illustrative. They are not a client result or a published statistic.

export const showcaseBusiness = {
  name: "Cedarline Roofing",
  label: "Fictional demonstration. Not a client.",
  inquiry: "CL-204",
} as const;

export const scribeScript = {
  en: [
    { who: "Caller", text: "A section of our warehouse roof is leaking after last night's storm. We need someone this week." },
    { who: "Receptionist", text: "Thanks for calling Cedarline Roofing. I'm the AI assistant, and this call is recorded. I'm not a person from the crew. Is anyone in danger, or is there water near electrical equipment?" },
    { who: "Caller", text: "No. It's a commercial building, and I'm the facilities manager." },
    { who: "Receptionist", text: "I'll mark this as a commercial leak, urgent, and send it to the owner with that reason. I can hold a site visit. I can't give a binding price on this call." },
  ],
  es: [
    { who: "Caller", text: "Tenemos una gotera en el techo del almacén. Necesitamos a alguien esta semana." },
    { who: "Receptionist", text: "Gracias por llamar a Cedarline Roofing. Soy el asistente de inteligencia artificial y esta llamada se graba. ¿Hay peligro, o agua cerca de equipos eléctricos?" },
    { who: "Caller", text: "No. Es un edificio comercial y yo administro las instalaciones." },
    { who: "Receptionist", text: "Lo marco como una filtración comercial, urgente, y se lo paso al dueño con ese motivo. Puedo reservar una visita. No puedo dar un precio cerrado en esta llamada." },
  ],
} as const;

export const timelineStages = [
  { n: 1, title: "Inquiry received and qualified", customer: "The facilities manager describes a warehouse leak and asks for this week.", business: "Priority is high because it is commercial and urgent. The reason is stored with the inquiry.", tool: "createInquiry", next: "Offer a site visit. Do not quote a binding price." },
  { n: 2, title: "Estimate visit booked", customer: "A confirmation names the time and says the visit is not a final price.", business: "The appointment is stored once. A repeated webhook returns the same booking.", tool: "bookAppointment", next: "Visit the site and collect photos the owner may use." },
  { n: 3, title: "Estimate prepared and approved", customer: "The proposal is sent for approval. The sample total is labeled illustrative.", business: "The estimate stays a draft until someone with authority approves it.", tool: "updateJob", next: "Schedule the crew after approval." },
  { n: 4, title: "Work scheduled and in progress", customer: "The customer hears the start window.", business: "The job stage moves to in progress. Stated project value is not booked revenue.", tool: "updateJob", next: "Collect progress photos." },
  { n: 5, title: "Progress photos and notes", customer: "The customer can send a photo of a new detail.", business: "The file is stored with the inquiry and the job, with permission recorded.", tool: "attachMedia", next: "Finish the work and photograph the result." },
  { n: 6, title: "Completion and after photos", customer: "The customer is told the work is complete.", business: "After photos are kept beside the originals.", tool: "attachMedia", next: "Issue the invoice from the accounting system of record." },
  { n: 7, title: "Invoice issued", customer: "The customer can open the invoice after a verified sign-in.", business: "The invoice reference points at the accounting system. This demo amount is illustrative.", tool: "lookupAuthorizedInvoice", next: "Wait for a confirmed payment event." },
  { n: 8, title: "Payment confirmed", customer: "The customer sees the invoice as paid only after confirmation.", business: "A note in the job is not enough. Confirmation comes from a provider event or an authorized recorded action.", tool: "confirmPayment", next: "Invite an honest review if the policy allows it." },
  { n: 9, title: "Review invitation", customer: "The customer gets the business's review link and writes the review. There is no incentive.", business: "Reminders stop after completion, an opt-out, or the reminder limit.", tool: "requestReview", next: "Draft content from the job while the owner reviews it." },
  { n: 10, title: "Content options prepared", customer: "Nothing is posted.", business: "Three concepts use the job note and the approved files. Generation cost is shown before a render.", tool: "generateContentOptions", next: "The owner edits or approves one." },
  { n: 11, title: "Approved content", customer: "Still nothing public.", business: "Publication is refused until the draft is approved. With no platform credential, the status stays blocked and no fake post URL is stored.", tool: "approveContent", next: "Connect a platform or export the draft." },
  { n: 12, title: "Follow-up recorded", customer: "A later inquiry from the same account keeps the history.", business: "Reach and inquiries are stored separately. A view is not a booked job.", tool: "updateJob", next: "Use the result when choosing the next concept." },
] as const;

export const industries = [
  { name: "Roofing", detail: "Storm leaks, replacements, and commercial roofs. A photo of the slope and a site visit usually come before a price." },
  { name: "Solar installation", detail: "Homeowners and property owners comparing proposals. Utility bills and roof condition are part of the inquiry, not a promise of savings." },
  { name: "Commercial and industrial", detail: "More than one contact, a site walk, drawings, and an RFP. The lead is marked high because of the fit and the scope." },
  { name: "Remodeling and property management", detail: "A manager may call for many units. The decision-maker is recorded separately from the person who called." },
  { name: "Plumbing and HVAC", detail: "The same receptionist and workflow, for businesses whose work is often a repair, a replacement, or a maintenance agreement." },
] as const;
