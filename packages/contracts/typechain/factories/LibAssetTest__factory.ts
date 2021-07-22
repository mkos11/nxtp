/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type { LibAssetTest, LibAssetTestInterface } from "../LibAssetTest";

const _abi = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "assetId",
        type: "address",
      },
    ],
    name: "getOwnBalance",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "assetId",
        type: "address",
      },
    ],
    name: "isEther",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "assetId",
        type: "address",
      },
      {
        internalType: "address payable",
        name: "recipient",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "transferAsset",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "assetId",
        type: "address",
      },
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "transferERC20",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address payable",
        name: "recipient",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "transferEther",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    stateMutability: "payable",
    type: "receive",
  },
];

const _bytecode =
  "0x608060405234801561001057600080fd5b506106e3806100206000396000f3fe60806040526004361061004e5760003560e01c806305b1137b1461005a578063439e2e451461007c5780634b93c8751461009c5780639db5dbe4146100d1578063a7d2fdf6146100f157600080fd5b3661005557005b600080fd5b34801561006657600080fd5b5061007a61007536600461055f565b61011f565b005b34801561008857600080fd5b5061007a61009736600461058a565b61012d565b3480156100a857600080fd5b506100bc6100b7366004610543565b61013d565b60405190151581526020015b60405180910390f35b3480156100dd57600080fd5b5061007a6100ec3660046105ca565b610151565b3480156100fd57600080fd5b5061011161010c366004610543565b61015c565b6040519081526020016100c8565b6101298282610167565b5050565b6101388383836101f9565b505050565b60006001600160a01b038216155b92915050565b61013883838361021d565b600061014b82610228565b6000826001600160a01b03168260405160006040518083038185875af1925050503d80600081146101b4576040519150601f19603f3d011682016040523d82523d6000602084013e6101b9565b606091505b50509050806101385760405162461bcd60e51b8152602060048201526007602482015266046a88a746064760cb1b60448201526064015b60405180910390fd5b6001600160a01b038316156102135761013883838361021d565b6101388282610167565b6101388383836102bc565b60006001600160a01b038216156102b5576040516370a0823160e01b81523060048201526001600160a01b038316906370a082319060240160206040518083038186803b15801561027857600080fd5b505afa15801561028c573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906102b091906105fe565b61014b565b4792915050565b604080516001600160a01b03848116602483015260448083018590528351808403909101815260649092018352602080830180516001600160e01b031663a9059cbb60e01b17905283518085019094528084527f5361666545524332303a206c6f772d6c6576656c2063616c6c206661696c6564908401526101389286929160009161034c9185169084906103c9565b805190915015610138578080602001905181019061036a91906105de565b6101385760405162461bcd60e51b815260206004820152602a60248201527f5361666545524332303a204552433230206f7065726174696f6e20646964206e6044820152691bdd081cdd58d8d9595960b21b60648201526084016101f0565b60606103d884846000856103e2565b90505b9392505050565b6060824710156104435760405162461bcd60e51b815260206004820152602660248201527f416464726573733a20696e73756666696369656e742062616c616e636520666f6044820152651c8818d85b1b60d21b60648201526084016101f0565b843b6104915760405162461bcd60e51b815260206004820152601d60248201527f416464726573733a2063616c6c20746f206e6f6e2d636f6e747261637400000060448201526064016101f0565b600080866001600160a01b031685876040516104ad9190610616565b60006040518083038185875af1925050503d80600081146104ea576040519150601f19603f3d011682016040523d82523d6000602084013e6104ef565b606091505b50915091506104ff82828661050a565b979650505050505050565b606083156105195750816103db565b8251156105295782518084602001fd5b8160405162461bcd60e51b81526004016101f09190610632565b600060208284031215610554578081fd5b81356103db81610695565b60008060408385031215610571578081fd5b823561057c81610695565b946020939093013593505050565b60008060006060848603121561059e578081fd5b83356105a981610695565b925060208401356105b981610695565b929592945050506040919091013590565b60008060006060848603121561059e578283fd5b6000602082840312156105ef578081fd5b815180151581146103db578182fd5b60006020828403121561060f578081fd5b5051919050565b60008251610628818460208701610665565b9190910192915050565b6020815260008251806020840152610651816040850160208701610665565b601f01601f19169190910160400192915050565b60005b83811015610680578181015183820152602001610668565b8381111561068f576000848401525b50505050565b6001600160a01b03811681146106aa57600080fd5b5056fea2646970667358221220a89bd4482bce2d3ce6d6b3f3a211dc6ccd4f3f1dd5efc18d45f92c1420c9efac64736f6c63430008040033";

export class LibAssetTest__factory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<LibAssetTest> {
    return super.deploy(overrides || {}) as Promise<LibAssetTest>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): LibAssetTest {
    return super.attach(address) as LibAssetTest;
  }
  connect(signer: Signer): LibAssetTest__factory {
    return super.connect(signer) as LibAssetTest__factory;
  }
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): LibAssetTestInterface {
    return new utils.Interface(_abi) as LibAssetTestInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): LibAssetTest {
    return new Contract(address, _abi, signerOrProvider) as LibAssetTest;
  }
}
