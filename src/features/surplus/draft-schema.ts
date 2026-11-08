import { z } from "zod";

const text = (max: number) => z.string().max(max).refine(value => value.trim().length > 0, "Enter a value.");
const money = z.number().finite().min(0).max(100000)
  .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, "Use at most two decimal places.");
const pickupTime = z.string().refine(value => Number.isFinite(Date.parse(value)), "Enter a valid pickup time.");

/** Match the local inventory rules while giving the HTTP form useful field hints. */
export function listingDraftSchema(now: number) {
  return z.object({
    merchantName: text(100), address: text(300), title: text(150),
    lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180),
    origPrice: money, price: money, qtyLeft: z.number().int().min(1).max(10000),
    pickupStart: pickupTime, pickupEnd: pickupTime,
    allergens: z.array(text(80)).max(30), description: z.string().max(1000).optional(),
  }).superRefine((value, context) => {
    if (value.price > value.origPrice) context.addIssue({ code: "custom", path: ["price"], message: "The surplus price cannot exceed the original price." });
    if (Date.parse(value.pickupEnd) <= Date.parse(value.pickupStart)) context.addIssue({ code: "custom", path: ["pickupEnd"], message: "Pickup must end after it starts." });
    if (Date.parse(value.pickupEnd) <= now) context.addIssue({ code: "custom", path: ["pickupEnd"], message: "Choose a pickup end time in the future." });
  });
}
