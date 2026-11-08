import type { AgentName } from '../types';

/** 模型调用的可复现元数据：模型名、版本、温度、随机种子、提示词模板版本 */
export interface ModelCallMeta {
  modelName: string;
  modelVersion: string;
  temperature: number;
  randomSeed: string | number;
  promptTemplateVersion: string;
  promptTemplate: string;
  agent: AgentName;
  timestamp: string;
}

export interface ModelCallRequest<T> {
  agent: AgentName;
  promptTemplate: string;
  promptTemplateVersion?: string;
  input: T;
  temperature?: number;
  randomSeed?: string | number;
}

export interface ModelCallResult<T> {
  output: T;
  meta: ModelCallMeta;
}

export interface ModelAdapter {
  readonly modelName: string;
  readonly modelVersion: string;
  readonly calls: readonly ModelCallMeta[];
  call<T>(
    request: ModelCallRequest<T>,
    generate: (request: ModelCallRequest<T>) => T | Promise<T>,
  ): Promise<ModelCallResult<T>>;
  getCalls(): readonly ModelCallMeta[];
}

export interface MockModelAdapterConfig {
  modelName?: string;
  modelVersion?: string;
  temperature?: number;
  randomSeed?: string | number;
  promptTemplateVersion?: string;
}

/**
 * 模型层 mock 适配器：不调用真实模型，只执行注入的生成函数，
 * 并逐次记录模型名、版本、温度、随机种子与提示词模板版本。
 */
export class MockModelAdapter implements ModelAdapter {
  readonly modelName: string;
  readonly modelVersion: string;

  private readonly defaultTemperature: number;
  private readonly defaultRandomSeed: string | number;
  private readonly defaultPromptTemplateVersion: string;
  private callLog: ModelCallMeta[] = [];

  constructor(config: MockModelAdapterConfig = {}) {
    this.modelName = config.modelName ?? 'mock-papercompile';
    this.modelVersion = config.modelVersion ?? 'mock-1.0';
    this.defaultTemperature = config.temperature ?? 0.2;
    this.defaultRandomSeed = config.randomSeed ?? 'seed-1';
    this.defaultPromptTemplateVersion = config.promptTemplateVersion ?? 'v1';
  }

  get calls(): readonly ModelCallMeta[] {
    return this.callLog;
  }

  getCalls(): readonly ModelCallMeta[] {
    return [...this.callLog];
  }

  async call<T>(
    request: ModelCallRequest<T>,
    generate: (request: ModelCallRequest<T>) => T | Promise<T>,
  ): Promise<ModelCallResult<T>> {
    const meta: ModelCallMeta = {
      modelName: this.modelName,
      modelVersion: this.modelVersion,
      temperature: request.temperature ?? this.defaultTemperature,
      randomSeed: request.randomSeed ?? this.defaultRandomSeed,
      promptTemplateVersion:
        request.promptTemplateVersion ?? this.defaultPromptTemplateVersion,
      promptTemplate: request.promptTemplate,
      agent: request.agent,
      timestamp: new Date().toISOString(),
    };
    const output = await generate(request);
    this.callLog = [...this.callLog, meta];
    return { output, meta };
  }
}

export const createMockModelAdapter = (
  config: MockModelAdapterConfig = {},
): MockModelAdapter => new MockModelAdapter(config);

export const mockModelAdapter = createMockModelAdapter();
