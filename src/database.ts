export class Database {
  name: string;
  tenant: string | null;
  charset: string;
  collation: string;
  metadata: Record<string, any>;

  constructor(
    name: string,
    tenant: string | null = null,
    charset: string = '',
    collation: string = '',
    metadata: Record<string, any> = {}
  ) {
    this.name = name;
    this.tenant = tenant;
    this.charset = charset;
    this.collation = collation;
    this.metadata = metadata;
  }

  toString(): string {
    return this.name;
  }

  equals(other: Database): boolean {
    return this.name === other.name && this.tenant === other.tenant;
  }
}

