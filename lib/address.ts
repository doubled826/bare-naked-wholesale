export type BusinessAddressParts = {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
};

export const parseBusinessAddress = (address: string): BusinessAddressParts => {
  const trimmed = address.trim();
  if (!trimmed) return {};

  const parts = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 1) {
    return { street: parts[0] };
  }

  if (parts.length === 2) {
    const [streetPart, cityStateZipPart] = parts;
    const [cityPart, stateZipPart] = cityStateZipPart.split(',', 2).map((part) => part.trim());
    const { state, zip } = parseStateZip(stateZipPart || cityStateZipPart);
    return {
      street: streetPart,
      city: cityPart || '',
      state,
      zip,
    };
  }

  const streetParts = parts.slice(0, -2);
  const cityPart = parts[parts.length - 2] || '';
  const stateZipPart = parts[parts.length - 1] || '';
  const { state, zip } = parseStateZip(stateZipPart);

  return {
    street: streetParts.join(', '),
    city: cityPart,
    state,
    zip,
  };
};

const parseStateZip = (value: string) => {
  if (!value) return { state: '', zip: '' };
  const tokens = value.split(' ').filter(Boolean);
  if (tokens.length === 0) return { state: '', zip: '' };
  if (tokens.length === 1) return { state: tokens[0], zip: '' };
  return { state: tokens[0], zip: tokens.slice(1).join(' ') };
};

export const formatBusinessAddress = (parts: BusinessAddressParts) => {
  const street = parts.street?.trim() || '';
  const city = parts.city?.trim() || '';
  const state = parts.state?.trim() || '';
  const zip = parts.zip?.trim() || '';

  let lineTwo = '';
  if (city) {
    lineTwo = city;
  }
  if (state) {
    lineTwo = lineTwo ? `${lineTwo}, ${state}` : state;
  }
  if (zip) {
    lineTwo = lineTwo ? `${lineTwo} ${zip}` : zip;
  }

  return [street, lineTwo].filter(Boolean).join(', ');
};
