import assert from 'node:assert/strict';
import { formatBusinessAddress, parseBusinessAddress } from '@/lib/address';

const cases = [
  {
    input: '123 Main St, City, ST 12345',
    expected: { street: '123 Main St', city: 'City', state: 'ST', zip: '12345' },
  },
  {
    input: '123 Main St, Suite 200, City, ST 12345',
    expected: { street: '123 Main St, Suite 200', city: 'City', state: 'ST', zip: '12345' },
  },
  {
    input: '789 Broad Ave, City, ST',
    expected: { street: '789 Broad Ave', city: 'City', state: 'ST', zip: '' },
  },
  {
    input: '456 Elm St',
    expected: { street: '456 Elm St', city: '', state: '', zip: '' },
  },
];

cases.forEach(({ input, expected }) => {
  assert.deepEqual(parseBusinessAddress(input), expected, `parse failed: ${input}`);
  assert.equal(formatBusinessAddress(expected), input.replace(/,\s*$/, ''), `format failed: ${input}`);
});

const formatted = formatBusinessAddress({
  street: '12 Market St',
  city: 'San Jose',
  state: 'CA',
  zip: '95113',
});
assert.equal(formatted, '12 Market St, San Jose, CA 95113');

console.log('address tests passed');
