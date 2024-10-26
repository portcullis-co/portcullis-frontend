import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';
import { Resend } from 'resend';

const resend = new Resend('re_CAiLvhVL_Hq6K3xEkCsqMAe77JS1m5Gdm');

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { userId, orgId } = auth();
    const { logo, redirectUrl, internal_warehouse, recipient_email, hashedPhrase, seedPhrase } = await request.json();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized: No organization ID' }, { status: 401 });
    }

    const invite_token = nanoid(10);

    const { data, error } = await supabase
      .from('links')
      .insert({ 
        invite_token,
        internal_warehouse,
        logo,
        redirect_url: redirectUrl,
        recipient_email,
        organization: orgId,
        hashed_phrase: hashedPhrase,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const internal_logo = "https://portcullis-app.fly.dev/portcullis.svg"
    // Send email using Resend
    const emailHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">

  <head>
    <link rel="preload" as="image" href="${internal_logo}" />
    <link rel="preload" as="image" href="https://react-email-demo-3kjjfblod-resend.vercel.app/static/slack-twitter.png" />
    <link rel="preload" as="image" href="https://react-email-demo-3kjjfblod-resend.vercel.app/static/slack-facebook.png" />
    <link rel="preload" as="image" href="https://react-email-demo-3kjjfblod-resend.vercel.app/static/slack-linkedin.png" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" /><!--$-->
  </head>
  <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Confirm your email address<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
  </div>

  <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, &#x27;Roboto&#x27;, &#x27;Oxygen&#x27;, &#x27;Ubuntu&#x27;, &#x27;Cantarell&#x27;, &#x27;Fira Sans&#x27;, &#x27;Droid Sans&#x27;, &#x27;Helvetica Neue&#x27;, sans-serif">
    <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em;margin:0 auto;padding:0px 20px">
      <tbody>
        <tr style="width:100%">
          <td>
            <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin-top:32px">
              <tbody>
                <tr>
                  <td><img alt="Portcullis" height="36" src="${internal_logo}" style="display:block;outline:none;border:none;text-decoration:none" width="120" /><p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">Portcullis</p></td>
                </tr>
              </tbody>
            </table>
            <h1 style="color:#1d1c1d;font-size:36px;font-weight:700;margin:30px 0;padding:0;line-height:42px">You have recieved an invite for Data Export on Portcullis</h1>
            <p style="font-size:20px;line-height:28px;margin:16px 0;margin-bottom:30px">Your export seed phrase is below - enter it in your open browser window and we&#x27;ll help you ingest your data.</p>
            <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="background:rgb(245, 244, 245);border-radius:4px;margin-bottom:30px;padding:40px 10px">
              <tbody>
                <tr>
                  <td>
                    <p style="font-size:30px;line-height:24px;margin:16px 0;text-align:center;vertical-align:middle">${seedPhrase}</p>
                  </td>
                </tr>
              </tbody>
            </table>
            <p style="font-size:14px;line-height:24px;margin:16px 0;color:#000">If you didn&#x27;t request this email, there&#x27;s nothing to worry about, you can safely ignore it.</p>
            <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
              <tbody>
                <tr>
                  <td>
                    <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin-bottom:32px;padding-left:8px;padding-right:8px;width:100%">
                      <tbody style="width:100%">
                        <tr style="width:100%">
                          <td data-id="__react-email-column" style="width:66%"><img alt="Portcullis" height="36" src="${internal_logo}" style="display:block;outline:none;border:none;text-decoration:none" width="120" /><p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">Portcullis</p></td>
                          <td data-id="__react-email-column">
                            <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                              <tbody>
                                <tr>
                                  <td>
                                    <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                                      <tbody style="width:100%">
                                        <tr style="width:100%">
                                          <td data-id="__react-email-column"><a href="https://twitter.com/tryportcullis" style="color:#067df7;text-decoration:none" target="_blank"><img alt="Slack" height="32" src="https://react-email-demo-3kjjfblod-resend.vercel.app/static/slack-twitter.png" style="display:inline;outline:none;border:none;text-decoration:none;margin-left:32px" width="32" /></a></td>
                                          <td data-id="__react-email-column"><a href="https://www.facebook.com/tryportcullis" style="color:#067df7;text-decoration:none" target="_blank"><img alt="Slack" height="32" src="https://react-email-demo-3kjjfblod-resend.vercel.app/static/slack-facebook.png" style="display:inline;outline:none;border:none;text-decoration:none;margin-left:32px" width="32" /></a></td>
                                          <td data-id="__react-email-column"><a href="https://www.linkedin.com/company/tryportcullis" style="color:#067df7;text-decoration:none" target="_blank"><img alt="Slack" height="32" src="https://react-email-demo-3kjjfblod-resend.vercel.app/static/slack-linkedin.png" style="display:inline;outline:none;border:none;text-decoration:none;margin-left:32px" width="32" /></a></td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
            <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
              <tbody>
                <tr>
                  <td><a href="https://slackhq.com" rel="noopener noreferrer" style="color:#b7b7b7;text-decoration:underline" target="_blank">Our blog</a>   |   <a href="https://slack.com/legal" rel="noopener noreferrer" style="color:#b7b7b7;text-decoration:underline" target="_blank">Policies</a>   |   <a href="https://slack.com/help" rel="noopener noreferrer" style="color:#b7b7b7;text-decoration:underline" target="_blank">Help center</a>   |   <a href="https://slack.com/community" rel="noopener noreferrer" data-auth="NotApplicable" data-linkindex="6" style="color:#b7b7b7;text-decoration:underline" target="_blank">Slack Community</a>
                    <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">©2022 Slack Technologies, LLC, a Salesforce company. <br />500 Howard Street, San Francisco, CA 94105, USA <br /><br />All rights reserved.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table><!--/$-->
  </body>

</html>`;

    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: recipient_email,
        subject: 'Confirm your email address',
        html: emailHtml,
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Note: We're not returning here, as we still want to return the data even if email sending fails
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function GET() {
  const supabase = createClient();
  const { userId, orgId } = auth();

  if (!orgId) {
    return NextResponse.json({ error: 'Unauthorized: No organization ID' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('links')
    .select('*')
    .eq('organization', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient();
    const { userId, orgId } = auth();
    const { id } = await request.json();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized: No organization ID' }, { status: 401 });
    }

    const { error } = await supabase
      .from('links')
      .delete()
      .match({ id, organization: orgId });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}