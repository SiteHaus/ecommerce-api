import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import EasyPost from "@easypost/api";

export interface Address {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Parcel {
  weightOz: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
}

export interface Rate {
  rateId: string;
  carrier: string;
  service: string;
  amountCents: number;
  estimatedDays: number | null;
}

function toCents(rate: string): number {
  return Math.round(parseFloat(rate) * 100);
}

@Injectable()
export class EasypostService {
  private readonly client: any;

  constructor(private readonly config: ConfigService) {
    this.client = new EasyPost(config.getOrThrow("EASYPOST_API_KEY"));
  }

  /** Platform-level call — creates a child user under the SiteHaus parent account. */
  async provisionChildAccount(storeName: string): Promise<{ childUserId: string; apiKey: string }> {
    const child = await this.client.user.createChild({ name: storeName });
    return { childUserId: child.id, apiKey: child.api_keys[0].key };
  }

  async createShipment(params: {
    toAddress: Address;
    fromAddress: Address;
    parcel: Parcel;
  }): Promise<{ shipmentId: string; rates: Rate[] }> {
    const shipment = await this.client.shipment.create({
      to_address: params.toAddress,
      from_address: params.fromAddress,
      parcel: {
        weight: params.parcel.weightOz,
        length: params.parcel.lengthIn,
        width: params.parcel.widthIn,
        height: params.parcel.heightIn,
      },
    });

    return {
      shipmentId: shipment.id,
      rates: shipment.rates.map((r: any) => ({
        rateId: r.id,
        carrier: r.carrier,
        service: r.service,
        amountCents: toCents(r.rate),
        estimatedDays: r.delivery_days ?? null,
      })),
    };
  }

  async buyLabel(
    shipmentId: string,
    rateId: string,
  ): Promise<{
    trackingCode: string;
    labelUrl: string;
    carrier: string;
    service: string;
    costCents: number;
  }> {
    const bought = await this.client.shipment.buy(shipmentId, { rate: { id: rateId } });
    return {
      trackingCode: bought.tracking_code,
      labelUrl: bought.postage_label.label_url,
      carrier: bought.selected_rate.carrier,
      service: bought.selected_rate.service,
      costCents: toCents(bought.selected_rate.rate),
    };
  }
}
