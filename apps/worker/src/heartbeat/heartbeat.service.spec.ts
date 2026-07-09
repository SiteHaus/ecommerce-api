import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HeartbeatService } from "./heartbeat.service";

describe("HeartbeatService", () => {
  let fetchMock: jest.Mock;

  async function makeService(env: Record<string, string | undefined>) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeartbeatService,
        { provide: ConfigService, useValue: { get: (k: string) => env[k] } },
      ],
    }).compile();
    return module.get(HeartbeatService);
  }

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("stays off when env is not configured", async () => {
    const service = await makeService({});
    service.onModuleInit();
    jest.advanceTimersByTime(HeartbeatService.INTERVAL_MS * 3);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("beats immediately and then on the interval", async () => {
    const service = await makeService({
      LIGHTHAUS_HEARTBEAT_URL: "https://lighthaus-api.sitehaus.dev/heartbeat",
      LIGHTHAUS_HEARTBEAT_SECRET: "s3cret",
    });
    service.onModuleInit();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(HeartbeatService.INTERVAL_MS * 2);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://lighthaus-api.sitehaus.dev/heartbeat");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer s3cret");
    expect(JSON.parse(init.body as string)).toEqual({ service: "commerce-worker" });

    service.onModuleDestroy();
  });

  it("swallows fetch failures without throwing", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const service = await makeService({
      LIGHTHAUS_HEARTBEAT_URL: "https://lighthaus-api.sitehaus.dev/heartbeat",
      LIGHTHAUS_HEARTBEAT_SECRET: "s3cret",
    });
    await expect(service.beat("https://x.test/heartbeat", "s3cret")).resolves.toBeUndefined();
  });

  it("stops beating after module destroy", async () => {
    const service = await makeService({
      LIGHTHAUS_HEARTBEAT_URL: "https://lighthaus-api.sitehaus.dev/heartbeat",
      LIGHTHAUS_HEARTBEAT_SECRET: "s3cret",
    });
    service.onModuleInit();
    service.onModuleDestroy();
    fetchMock.mockClear();
    jest.advanceTimersByTime(HeartbeatService.INTERVAL_MS * 3);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
