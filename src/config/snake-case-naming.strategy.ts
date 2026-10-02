import { DefaultNamingStrategy } from 'typeorm';

const snakeCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

export class SnakeCaseNamingStrategy extends DefaultNamingStrategy {
  override columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    return snakeCase(
      [...embeddedPrefixes, customName || propertyName].join('_'),
    );
  }

  override relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }

  override joinColumnName(
    relationName: string,
    referencedColumnName: string,
  ): string {
    return snakeCase(`${relationName}_${referencedColumnName}`);
  }

  override joinTableColumnName(
    relationName: string,
    propertyName: string,
    referencedColumnName: string,
  ): string {
    return snakeCase(
      `${relationName}_${propertyName}_${referencedColumnName}`,
    );
  }
}