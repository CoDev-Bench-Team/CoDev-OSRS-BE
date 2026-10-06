import type { ValidationError } from 'class-validator';
import { toValidationProblemDetails } from './problem-details.filter.js';

const pointersFor = (errors: ValidationError[]) =>
  (toValidationProblemDetails(errors).getResponse() as { error: { errors: { pointer: string }[] } }).error.errors.map(
    (error) => error.pointer,
  );

const failure = (property: string, children: ValidationError[] = [], constraints?: Record<string, string>): ValidationError => ({
  property,
  children,
  constraints,
});

describe('validation problem pointers', () => {
  it('points at a top-level field', () => {
    expect(pointersFor([failure('reason', [], { matches: 'reason is required' })])).toEqual(['#/reason']);
  });

  it('separates nested array fields with slashes (items[0].quantity)', () => {
    const errors = [failure('items', [failure('0', [failure('quantity', [], { min: 'quantity must not be less than 1' })])])];

    expect(pointersFor(errors)).toEqual(['#/items/0/quantity']);
  });

  it('escapes ~ and / inside a single token', () => {
    expect(pointersFor([failure('a/b~c', [], { isString: 'must be a string' })])).toEqual(['#/a~1b~0c']);
  });
});
