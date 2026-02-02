type Databases = Database | OBDatabase;

export class Database {
  name: string;
  charset: string;
  collation: string;
  metadata: Record<string, any>;

  constructor(
    name: string,
    charset: string = "",
    collation: string = "",
    metadata: Record<string, any> = {}
  ) {
    this.name = name;
    this.charset = charset;
    this.collation = collation;
    this.metadata = metadata;
  }

  toString(): string {
    return this.name;
  }

  equals(other: Databases): boolean {
    return this.name === other.name;
  }
}

export class OBDatabase extends Database {
  tenant: string;

  constructor(
    name: string,
    tenant: string = "",
    charset: string = "",
    collation: string = "",
    metadata: Record<string, any> = {}
  ) {
    super(name, charset, collation, metadata);
    this.tenant = tenant;
  }

  toString(): string {
    return this.name;
  }

  equals(other: Databases): boolean {
    return (
      other instanceof OBDatabase &&
      this.name === other.name &&
      this.tenant === other.tenant
    );
  }
}
