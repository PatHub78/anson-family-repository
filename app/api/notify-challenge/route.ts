// app/api/notify-challenge/route.ts

import { NextRequest, NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM_EMAIL     = "challenges@ansonfamily.site";
const APP_URL        = "https://www.ansonfamily.site";

export async function POST(req: NextRequest) {
  try {
    const {
      challengerName,
      challengerEmail,
      challengeText,
      targetEmail,
      targetName,
    } = await req.json();

    // Build recipient list
    let recipients: { email: string; name: string }[] = [];

    if (targetEmail) {
      // Specific person challenged
      recipients = [{ email: targetEmail, name: targetName ?? targetEmail }];
    } else {
      // Open challenge — fetch all profiles except the challenger
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("email, full_name");

      recipients = (profiles ?? [])
        .filter((p: { email: string }) => p.email !== challengerEmail)
        .map((p: { email: string; full_name: string }) => ({
          email: p.email,
          name: p.full_name,
        }));
    }

    if (recipients.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    // Send one personalised email per recipient
    const results = await Promise.allSettled(
      recipients.map(async ({ email, name }) => {
        const firstName       = name?.split(" ")[0] ?? name;
        const isDirectChallenge = !!targetEmail;
        const greeting        = isDirectChallenge
          ? `Hey ${firstName}! You've been challenged!`
          : `Hey ${firstName}! There's a new open challenge for the whole family!`;

        const html = `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
            <div style="background: linear-gradient(135deg, #1a1a2e, #0f3460); border-radius: 20px; padding: 32px; text-align: center; margin-bottom: 24px;">
              <div style="font-size: 48px; margin-bottom: 12px;">🏆</div>
              <h1 style="color: #fff; font-size: 24px; font-weight: 900; margin: 0 0 8px;">
                ${greeting}
              </h1>
              <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin: 0;">
                ${challengerName} has thrown down a challenge on the Anson Family App
              </p>
            </div>

            <div style="background: #f9fafb; border-radius: 16px; padding: 20px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
              <p style="color: #374151; font-size: 16px; font-weight: 600; margin: 0; line-height: 1.5;">
                "${challengeText}"
              </p>
            </div>

            <div style="text-align: center;">
              <a
                href="${APP_URL}/weekly-challenges"
                style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 14px; text-decoration: none;"
              >
                👀 See the Challenge
              </a>
            </div>

            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
              Anson Family App · You're receiving this because you're part of the family 🏡
            </p>
          </div>
        `;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: email,
            subject: `${challengerName} has challenged ${isDirectChallenge ? "you" : "the whole family"}! 🔥`,
            html,
          }),
        });

        if (!res.ok) throw new Error(`Resend error for ${email}: ${await res.text()}`);
        return email;
      })
    );

    const sent   = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ ok: true, sent, failed });

  } catch (err) {
    console.error("notify-challenge error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}