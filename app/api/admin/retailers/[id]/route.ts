import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { isValidEmail } from '@/lib/utils';

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const retailerId = params.id;

    if (!retailerId) {
      return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 });
    }

    const [{ data: retailer, error: retailerError }, { data: retailerUser, error: userError }] = await Promise.all([
      adminClient
        .from('retailers')
        .select('id, company_name, business_address, phone')
        .eq('id', retailerId)
        .single(),
      adminClient.auth.admin.getUserById(retailerId),
    ]);

    if (retailerError || !retailer) {
      return NextResponse.json({ error: 'Retailer not found' }, { status: 404 });
    }

    if (userError || !retailerUser?.user) {
      return NextResponse.json({ error: 'Retailer auth record not found' }, { status: 404 });
    }

    return NextResponse.json({
      retailer: {
        ...retailer,
        email: retailerUser.user.email || '',
      },
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Get retailer error:', error);
    return NextResponse.json({ error: 'An error occurred while fetching the retailer' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const retailerId = params.id;

    if (!retailerId) {
      return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 });
    }

    const body = await request.json();
    const companyName = typeof body.company_name === 'string' ? body.company_name.trim() : '';
    const businessAddress = typeof body.business_address === 'string' ? body.business_address.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    const { data: retailerUser, error: retailerUserError } = await adminClient.auth.admin.getUserById(retailerId);

    if (retailerUserError || !retailerUser?.user) {
      return NextResponse.json({ error: 'Retailer auth record not found' }, { status: 404 });
    }

    const existingMetadata = retailerUser.user.user_metadata || {};
    const nextMetadata = {
      ...existingMetadata,
      company_name: companyName,
      business_address: businessAddress,
      phone,
      email,
    };

    const emailChanged = (retailerUser.user.email || '').toLowerCase() !== email;

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(retailerId, {
      email,
      email_confirm: emailChanged ? true : undefined,
      user_metadata: nextMetadata,
    });

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message || 'Failed to update retailer email' }, { status: 400 });
    }

    const { error: retailerUpdateError } = await adminClient
      .from('retailers')
      .update({
        company_name: companyName,
        business_address: businessAddress,
        phone,
      })
      .eq('id', retailerId);

    if (retailerUpdateError) {
      return NextResponse.json({ error: retailerUpdateError.message || 'Failed to update retailer profile' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      retailer: {
        id: retailerId,
        company_name: companyName,
        business_address: businessAddress,
        phone,
        email,
      },
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Update retailer error:', error);
    return NextResponse.json({ error: 'An error occurred while updating the retailer' }, { status: 500 });
  }
}
