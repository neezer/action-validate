import { Action, make as makeAction } from "@neezer/action";
import http from "http";
import test, { Test } from "tape";
import { makeValidator } from "../src";

type ServerClose = (cb: () => void) => void;
type Callback = (uri: string, close: ServerClose) => void;

const schema = {
  $id: "http://schemas.example.com/fruit",
  $schema: "http://json-schema.org/draft-07/schema",
  properties: {
    fruit: {
      type: "string"
    }
  },
  required: ["fruit"]
};

test("downloads schema", (t: Test) => {
  makeSchemaServer(schema, 200, async (uri, close) => {
    const validate = makeValidator(uri);
    const action = makeAction("test")("fruit", { fruit: "bananas" });

    try {
      await validate(action);
      t.pass("passed validation");
    } catch (error) {
      t.fail(error.message);
    } finally {
      close(t.end);
    }
  });
});

test("throws if schema missing for type", (t: Test) => {
  makeSchemaServer(schema, 404, async (uri, close) => {
    const validate = makeValidator(uri);
    const action = makeAction("test")("veggies", { veggies: "broccoli" });

    try {
      await validate(action);
      t.fail("does not throw");
    } catch (error) {
      t.pass(error.message);
    } finally {
      close(t.end);
    }
  });
});

test("throws if validation failed", (t: Test) => {
  makeSchemaServer(schema, 200, async (uri, close) => {
    const validate = makeValidator(uri);
    const action = makeAction("test")("fruit", { veggies: "broccoli" });

    try {
      await validate(action);
      t.fail("does not throw");
    } catch (error) {
      t.equal(
        error.message,
        "payload invalid for action.type=fruit: should have required property 'fruit'",
        "error message is correct"
      );
    } finally {
      close(t.end);
    }
  });
});

test("caches validation functions", (t: Test) => {
  const action = makeAction("test")("fruit", { fruit: "bananas" });

  let validate: (action: Action) => void;

  const offlineAssert = async () => {
    try {
      await validate(action);
      t.pass("passes offline validation");
    } catch (error) {
      t.fail(error.message);
    } finally {
      t.end();
    }
  };

  makeSchemaServer(schema, 200, async (uri, close) => {
    validate = makeValidator(uri);

    try {
      await validate(action);
      t.pass("passes online validation");
    } catch (error) {
      t.fail(error.message);
    } finally {
      close(offlineAssert);
    }
  });
});

function makeSchemaServer(schemaToServe: any, status: number, cb: Callback) {
  const server = http.createServer((_, res) => {
    res.statusCode = status;

    if (status === 404) {
      res.end();
    } else {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(schemaToServe));
    }
  });

  server.listen(0, () => {
    const addrInfo = server.address();

    const uri =
      typeof addrInfo === "string"
        ? addrInfo
        : `http://${addrInfo.address}:${addrInfo.port}`;

    cb(uri, server.close.bind(server));
  });
}
