import { Alert, Decision, Exposure, WarRoom, WarRoomActionItem, WarRoomMessage } from '@syntra/db';
import type { IAlert, IDecision, IExposure, IWarRoom, IWarRoomActionItem, IWarRoomMessage } from '@syntra/db';
import type { Types } from 'mongoose';

export interface WarRoomTranscriptData {
  room: IWarRoom;
  alert: IAlert | null;
  messages: IWarRoomMessage[];
  decisions: IDecision[];
  actionItems: IWarRoomActionItem[];
  exposures: IExposure[];
  generatedAt: Date;
}

export async function buildWarRoomTranscriptData(
  roomId: string,
  orgId: Types.ObjectId,
): Promise<WarRoomTranscriptData> {
  const room = await WarRoom.findOne({ _id: roomId, org_id: orgId }).lean() as unknown as IWarRoom | null;
  if (!room) throw Object.assign(new Error('War room not found'), { status: 404 });

  const [alert, messages, actionItems, decisions, exposures] = await Promise.all([
    room.alert_id
      ? Alert.findOne({ _id: room.alert_id, org_id: orgId }).lean() as unknown as Promise<IAlert | null>
      : Promise.resolve(null),
    WarRoomMessage.find({ war_room_id: room._id }).sort({ created_at: 1 }).lean() as unknown as Promise<IWarRoomMessage[]>,
    WarRoomActionItem.find({ war_room_id: room._id, org_id: orgId }).sort({ created_at: 1 }).lean() as unknown as Promise<IWarRoomActionItem[]>,
    room.alert_id
      ? Decision.find({ alert_id: room.alert_id, org_id: orgId }).sort({ made_at: 1 }).lean() as unknown as Promise<IDecision[]>
      : Promise.resolve([]),
    room.alert_id
      ? Exposure.find({ alert_id: room.alert_id, org_id: orgId }).sort({ computed_at: -1 }).limit(25).lean() as unknown as Promise<IExposure[]>
      : Promise.resolve([]),
  ]);

  return {
    room,
    alert,
    messages,
    decisions,
    actionItems,
    exposures,
    generatedAt: new Date(),
  };
}
