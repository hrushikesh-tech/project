import { Kind, ValueNode, GraphQLScalarType } from "graphql";
import { Scalar } from "@nestjs/graphql";

function parseLiteral(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.OBJECT:
      return Object.fromEntries(
        ast.fields.map((field) => [field.name.value, parseLiteral(field.value)]),
      );
    case Kind.LIST:
      return ast.values.map((value) => parseLiteral(value));
    case Kind.NULL:
      return null;
    default:
      return null;
  }
}

@Scalar("JSON", () => Object)
export class JsonScalar extends GraphQLScalarType {
  constructor() {
    super({
      name: "JSON",
      description: "Arbitrary JSON payload",
      serialize(value: unknown) {
        return value;
      },
      parseValue(value: unknown) {
        return value;
      },
      parseLiteral,
    });
  }
}
