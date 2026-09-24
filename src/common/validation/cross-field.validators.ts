import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

const isPresent = (v: unknown) => v !== undefined && v !== null && v !== '';

/**
 * Passes when either side is absent, or when `value >= object[property]`.
 * Used for ranges such as `minPrice`..`maxPrice`.
 */
export function IsGreaterThanOrEqualTo(
  property: string,
  options?: ValidationOptions,
): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isGreaterThanOrEqualTo',
      target: object.constructor,
      propertyName: propertyName as string,
      constraints: [property],
      options: {
        message: `$property must be greater than or equal to ${property}`,
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const other = (args.object as Record<string, unknown>)[property];
          if (!isPresent(value) || !isPresent(other)) return true;
          return Number(value) >= Number(other);
        },
      },
    });
  };
}

/**
 * When this property is present (and `when` matches, if given), all
 * `properties` must be present too. Apply to each member of a group to get
 * "all or none" semantics.
 */
export function RequiresAlso(
  properties: string[],
  {
    when,
    ...options
  }: ValidationOptions & { when?: (value: unknown) => boolean } = {},
): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'requiresAlso',
      target: object.constructor,
      propertyName: propertyName as string,
      constraints: properties,
      options: {
        message: `$property requires ${properties.join(', ')} to also be provided`,
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (!isPresent(value) || (when && !when(value))) return true;
          const obj = args.object as Record<string, unknown>;
          return properties.every((p) => isPresent(obj[p]));
        },
      },
    });
  };
}
