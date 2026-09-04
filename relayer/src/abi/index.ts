import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Interface } from 'ethers';
import type { InterfaceAbi } from 'ethers';
import { abiDirectory, ConfigurationError } from '../config.js';

export type ContractArtifactName = 'InvoiceRegistry' | 'TrancheWaterfall' | 'AttestcoinVerifier';

const cache = new Map<ContractArtifactName, InterfaceAbi>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadAbi(name: ContractArtifactName): InterfaceAbi {
  const cached = cache.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const path = resolve(abiDirectory, `${name}.json`);
  if (!existsSync(path)) {
    throw new ConfigurationError(
      `${path} does not exist yet. ABI files are produced by the Contracts Engineer under docs/evidence/abi/.`,
    );
  }
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const fragments: unknown = Array.isArray(parsed) ? parsed : isPlainObject(parsed) ? parsed['abi'] : undefined;
  if (!Array.isArray(fragments)) {
    throw new ConfigurationError(
      `${path} is neither a bare ABI array nor an object with an "abi" array.`,
    );
  }
  const abi = fragments as InterfaceAbi;
  cache.set(name, abi);
  return abi;
}

export function loadInterface(name: ContractArtifactName): Interface {
  return new Interface(loadAbi(name));
}

export function requireFunctionFragment(name: ContractArtifactName, functionName: string) {
  const iface = loadInterface(name);
  const fragment = iface.fragments.find(
    (candidate) => candidate.type === 'function' && 'name' in candidate && candidate.name === functionName,
  );
  if (fragment === undefined) {
    const available = iface.fragments
      .filter((candidate) => candidate.type === 'function')
      .map((candidate) => candidate.format('sighash'))
      .join(', ');
    throw new ConfigurationError(
      `${name} ABI has no function "${functionName}". Available functions: ${available}`,
    );
  }
  return fragment;
}
