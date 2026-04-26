import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from "@nestjs/common";

const ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;

@Injectable()
export class EntityIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (typeof value !== "string" || !ENTITY_ID_PATTERN.test(value)) {
      throw new BadRequestException(
        "Resource identifier format is invalid.",
      );
    }

    return value;
  }
}
