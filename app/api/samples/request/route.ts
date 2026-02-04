import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendRetailerEmail } from '@/lib/email';

export async function POST() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: existing } = await supabase
      .from('sample_requests')
      .select('id, status')
      .eq('retailer_id', user.id)
      .eq('status', 'pending')
      .single();

    if (existing?.id) {
      return NextResponse.json({
        success: true,
        alreadyPending: true,
        message: 'Your request is already on file. Samples will be added to your next order.',
      });
    }

    const { error: insertError } = await supabase
      .from('sample_requests')
      .insert({ retailer_id: user.id, status: 'pending' });

    if (insertError) {
      return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
    }

    if (user.email) {
      await sendRetailerEmail({
        to: user.email,
        subject: 'Sample Request Received',
        text: 'Thanks! Your request has been submitted. We will include samples with your next order.',
      });
    }

    return NextResponse.json({
      success: true,
      alreadyPending: false,
      message: 'Request submitted. Samples will be added to your next order.',
    });
  } catch (error) {
    console.error('Sample request error:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
}
