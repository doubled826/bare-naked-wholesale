-- Two-tier retailer access: one owner account with location-scoped staff logins.

CREATE TABLE IF NOT EXISTS public.retailer_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (retailer_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.retailer_member_locations (
  membership_id UUID NOT NULL REFERENCES public.retailer_memberships(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.retailer_locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (membership_id, location_id)
);

CREATE TABLE IF NOT EXISTS public.retailer_staff_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'canceled', 'expired')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.retailer_staff_invitation_locations (
  invitation_id UUID NOT NULL REFERENCES public.retailer_staff_invitations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.retailer_locations(id) ON DELETE CASCADE,
  PRIMARY KEY (invitation_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_retailer_memberships_user
  ON public.retailer_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_retailer_memberships_retailer
  ON public.retailer_memberships(retailer_id, status);
CREATE INDEX IF NOT EXISTS idx_retailer_staff_invitations_retailer
  ON public.retailer_staff_invitations(retailer_id, status, created_at DESC);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS placed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS placed_by_name TEXT;

-- Every existing retailer login becomes the owner of its retailer organization.
INSERT INTO public.retailer_memberships (retailer_id, user_id, role, status, display_name, email)
SELECT
  retailers.id,
  users.id,
  'owner',
  'active',
  COALESCE(
    NULLIF(TRIM(users.raw_user_meta_data->>'display_name'), ''),
    NULLIF(TRIM(retailers.contact_name), ''),
    NULLIF(split_part(users.email, '@', 1), ''),
    'Owner'
  ),
  COALESCE(users.email, '')
FROM public.retailers AS retailers
JOIN auth.users AS users ON users.id = retailers.id
ON CONFLICT (retailer_id, user_id) DO UPDATE
SET role = 'owner', status = 'active', email = EXCLUDED.email, updated_at = NOW();

CREATE OR REPLACE FUNCTION public.current_retailer_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT membership.retailer_id
  FROM public.retailer_memberships AS membership
  WHERE membership.user_id = auth.uid()
    AND membership.status = 'active'
  ORDER BY CASE WHEN membership.role = 'owner' THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_retailer_owner(target_retailer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.retailer_memberships AS membership
    WHERE membership.user_id = auth.uid()
      AND membership.retailer_id = target_retailer_id
      AND membership.role = 'owner'
      AND membership.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_retailer_location(target_location_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.retailer_locations AS location
    JOIN public.retailer_memberships AS membership
      ON membership.retailer_id = location.retailer_id
     AND membership.user_id = auth.uid()
     AND membership.status = 'active'
    LEFT JOIN public.retailer_member_locations AS assignment
      ON assignment.membership_id = membership.id
     AND assignment.location_id = location.id
    WHERE location.id = target_location_id
      AND (membership.role = 'owner' OR assignment.location_id IS NOT NULL)
  );
$$;

ALTER TABLE public.retailer_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_member_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_staff_invitation_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their retailer memberships" ON public.retailer_memberships;
CREATE POLICY "Members can view their retailer memberships"
  ON public.retailer_memberships FOR SELECT
  USING (user_id = auth.uid() OR public.is_retailer_owner(retailer_id));

DROP POLICY IF EXISTS "Members can view their location assignments" ON public.retailer_member_locations;
CREATE POLICY "Members can view their location assignments"
  ON public.retailer_member_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.retailer_memberships AS membership
      WHERE membership.id = membership_id
        AND (membership.user_id = auth.uid() OR public.is_retailer_owner(membership.retailer_id))
    )
  );

DROP POLICY IF EXISTS "Retailer members can view their retailer" ON public.retailers;
CREATE POLICY "Retailer members can view their retailer"
  ON public.retailers FOR SELECT
  USING (id = public.current_retailer_id());

DROP POLICY IF EXISTS "Owners can update their retailer" ON public.retailers;
CREATE POLICY "Owners can update their retailer"
  ON public.retailers FOR UPDATE
  USING (public.is_retailer_owner(id))
  WITH CHECK (public.is_retailer_owner(id));

DROP POLICY IF EXISTS "Members can view accessible retailer locations" ON public.retailer_locations;
CREATE POLICY "Members can view accessible retailer locations"
  ON public.retailer_locations FOR SELECT
  USING (public.can_access_retailer_location(id));

DROP POLICY IF EXISTS "Owners can create retailer locations" ON public.retailer_locations;
CREATE POLICY "Owners can create retailer locations"
  ON public.retailer_locations FOR INSERT
  WITH CHECK (public.is_retailer_owner(retailer_id));

DROP POLICY IF EXISTS "Owners can update retailer locations" ON public.retailer_locations;
CREATE POLICY "Owners can update retailer locations"
  ON public.retailer_locations FOR UPDATE
  USING (public.is_retailer_owner(retailer_id))
  WITH CHECK (public.is_retailer_owner(retailer_id));

DROP POLICY IF EXISTS "Owners can delete retailer locations" ON public.retailer_locations;
CREATE POLICY "Owners can delete retailer locations"
  ON public.retailer_locations FOR DELETE
  USING (public.is_retailer_owner(retailer_id));

DROP POLICY IF EXISTS "Members can view accessible orders" ON public.orders;
CREATE POLICY "Members can view accessible orders"
  ON public.orders FOR SELECT
  USING (
    retailer_id = public.current_retailer_id()
    AND (
      public.is_retailer_owner(retailer_id)
      OR (location_id IS NOT NULL AND public.can_access_retailer_location(location_id))
    )
  );

DROP POLICY IF EXISTS "Members can view accessible order items" ON public.order_items;
CREATE POLICY "Members can view accessible order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders AS retailer_order
      WHERE retailer_order.id = order_id
        AND retailer_order.retailer_id = public.current_retailer_id()
        AND (
          public.is_retailer_owner(retailer_order.retailer_id)
          OR (retailer_order.location_id IS NOT NULL AND public.can_access_retailer_location(retailer_order.location_id))
        )
    )
  );

-- Auth invitations must not create a second retailer record for a staff user.
CREATE OR REPLACE FUNCTION public.handle_new_retailer()
RETURNS trigger AS $$
DECLARE
  retailer_company_name TEXT;
  retailer_business_address TEXT;
  retailer_phone TEXT;
BEGIN
  IF COALESCE(new.raw_user_meta_data->>'account_type', '') = 'retailer_staff' THEN
    RETURN new;
  END IF;

  retailer_company_name := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'company_name'), ''), 'New Retailer');
  retailer_business_address := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'business_address'), ''), 'No Address Provided');
  retailer_phone := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'phone'), ''), 'No Phone Provided');

  INSERT INTO public.retailers (
    id, company_name, business_address, phone, contact_name, tax_id,
    how_heard_about_us, how_heard_about_us_other, status
  ) VALUES (
    new.id, retailer_company_name, retailer_business_address, retailer_phone,
    NULLIF(TRIM(new.raw_user_meta_data->>'display_name'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'tax_id'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'how_heard_about_us'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'how_heard_about_us_other'), ''),
    'pending'
  );

  INSERT INTO public.retailer_memberships (
    retailer_id, user_id, role, status, display_name, email
  ) VALUES (
    new.id, new.id, 'owner', 'active',
    COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'display_name'), ''), 'Owner'),
    COALESCE(new.email, '')
  ) ON CONFLICT (retailer_id, user_id) DO NOTHING;

  IF retailer_business_address <> 'No Address Provided' THEN
    INSERT INTO public.retailer_locations (
      retailer_id, location_name, public_display_name, business_address, phone,
      is_default, is_public, locator_updated_at, locator_verified_at
    ) VALUES (
      new.id, 'Primary Address', retailer_company_name, retailer_business_address,
      NULLIF(retailer_phone, 'No Phone Provided'), true, true, NOW(), NOW()
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

