import { Action } from "@neezer/action";
import Ajv from "ajv";
import axios from "axios";
import makeDebug from "debug";

const debug = makeDebug("action-validate");
const ajv = new Ajv();
const cachedValidators: Record<string, Ajv.ValidateFunction> = {};

export function makeValidator(schemasUrl: string) {
  return async (action: Action) => {
    let validate = cachedValidators[action.type];

    if (validate === undefined) {
      debug("downloading schema for action.type=%s", action.type);

      const { data: schema } = await axios.get(`/schemas/${action.type}`, {
        baseURL: schemasUrl
      });

      validate = ajv.compile(schema);
      cachedValidators[action.type] = validate;
    } else {
      debug("using cached validator for action.type=%s", action.type);
    }

    if (!validate(action.payload)) {
      const errors =
        validate.errors !== undefined && validate.errors !== null
          ? validate.errors.map(e => e.message).join(",")
          : null;

      throw new Error(
        [`payload invalid for action.type=${action.type}`, errors]
          .filter(v => !!v)
          .join(": ")
      );
    }
  };
}
