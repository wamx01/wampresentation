(function (global) {
  function safeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function allocateQuotasByHamilton(costs, totalPeople, maxGroupSize) {
    const total = Math.max(0, Math.floor(safeNumber(totalPeople)));
    if (!Array.isArray(costs) || !costs.length) return [];
    if (total === 0) return new Array(costs.length).fill(0);

    const normalizedCosts = costs.map(cost => Math.max(0, safeNumber(cost)));
    const totalCost = normalizedCosts.reduce((sum, cost) => sum + cost, 0);
    if (totalCost <= 0) {
      const base = Math.floor(total / normalizedCosts.length);
      const remainder = total % normalizedCosts.length;
      return normalizedCosts.map((_, index) => base + (index < remainder ? 1 : 0));
    }

    const ideal = normalizedCosts.map(cost => (total * cost) / totalCost);
    let quotas = ideal.map(value => Math.floor(value));
    let allocated = quotas.reduce((sum, quota) => sum + quota, 0);
    let remainder = total - allocated;

    const fractions = ideal
      .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
      .sort((left, right) => right.fraction - left.fraction || left.index - right.index);

    for (let i = 0; i < fractions.length && remainder > 0; i++) {
      quotas[fractions[i].index] += 1;
      remainder -= 1;
    }

    if (maxGroupSize > 0) {
      quotas = quotas.map(quota => Math.min(quota, maxGroupSize));
      let missing = total - quotas.reduce((sum, quota) => sum + quota, 0);
      while (missing > 0) {
        const withRoom = fractions.find(item => quotas[item.index] < maxGroupSize);
        if (!withRoom) break;
        quotas[withRoom.index] += 1;
        missing -= 1;
      }
    }

    return quotas;
  }

  function buildMachineQuotas(options) {
    const { machines = [], totalPeople = 0, absMaxGroupSize = 0 } = options || {};
    const sortedMachines = [...machines]
      .map(machine => ({ ...machine, netValue: safeNumber(machine.netValue) }))
      .sort((left, right) => right.netValue - left.netValue || String(left.name || '').localeCompare(String(right.name || ''), 'es', { sensitivity: 'base' }));

    const quotas = allocateQuotasByHamilton(
      sortedMachines.map(machine => machine.netValue),
      totalPeople,
      absMaxGroupSize
    );

    return sortedMachines.map((machine, index) => ({
      machine,
      targetSize: quotas[index] || 0
    }));
  }

  function sortBlocks(blocks) {
    return [...blocks].sort((left, right) => {
      if (right.size !== left.size) return right.size - left.size;
      return String(left.name || '').localeCompare(String(right.name || ''), 'es', { sensitivity: 'base' });
    });
  }

  function chooseBestSlotIndex(slots, incomingSize, absMaxGroupSize) {
    return slots
      .map((slot, index) => {
        const currentSize = slot.currentSize || 0;
        const targetSize = slot.targetSize || 0;
        const nextSize = currentSize + incomingSize;
        return {
          index,
          currentSize,
          targetSize,
          remaining: targetSize - currentSize,
          overflow: Math.max(0, nextSize - targetSize),
          exceedsAbsMax: absMaxGroupSize > 0 && nextSize > absMaxGroupSize,
          machineValue: safeNumber(slot.machine?.netValue)
        };
      })
      .sort((left, right) => {
        const leftFits = left.remaining >= incomingSize ? 0 : 1;
        const rightFits = right.remaining >= incomingSize ? 0 : 1;
        if (leftFits !== rightFits) return leftFits - rightFits;
        if (left.exceedsAbsMax !== right.exceedsAbsMax) return left.exceedsAbsMax ? 1 : -1;
        if (left.overflow !== right.overflow) return left.overflow - right.overflow;
        if (left.remaining !== right.remaining) return right.remaining - left.remaining;
        if (left.currentSize !== right.currentSize) return left.currentSize - right.currentSize;
        return right.machineValue - left.machineValue;
      })[0]?.index ?? 0;
  }

  function assignBlockToSlot(slot, block) {
    slot.assignedBlockIds.push(block.id);
    slot.currentSize += block.size;
  }

  function buildMachineAssignmentPlan(options) {
    const {
      machines = [],
      teamBlocks = [],
      freePeopleCount = 0,
      absMaxGroupSize = 0
    } = options || {};

    const slots = buildMachineQuotas({
      machines,
      totalPeople: teamBlocks.reduce((sum, block) => sum + safeNumber(block.size), 0) + Math.max(0, Math.floor(safeNumber(freePeopleCount))),
      absMaxGroupSize
    }).map(slot => ({
      ...slot,
      assignedBlockIds: [],
      assignedFreePeopleCount: 0,
      currentSize: 0
    }));

    const remainingBlocks = sortBlocks(
      (teamBlocks || []).map(block => ({
        id: block.id,
        name: block.name,
        size: Math.max(0, Math.floor(safeNumber(block.size)))
      })).filter(block => block.size > 0)
    );

    slots.forEach(slot => {
      if (!remainingBlocks.length) return;

      assignBlockToSlot(slot, remainingBlocks.shift());

      while (remainingBlocks.length) {
        const remainingTarget = Math.max(0, slot.targetSize - slot.currentSize);
        if (remainingTarget <= 0) break;
        const fittingIndex = remainingBlocks.findIndex(block => block.size <= remainingTarget);
        if (fittingIndex === -1) break;
        assignBlockToSlot(slot, remainingBlocks.splice(fittingIndex, 1)[0]);
      }
    });

    while (remainingBlocks.length) {
      const block = remainingBlocks.shift();
      const slotIndex = chooseBestSlotIndex(slots, block.size, absMaxGroupSize);
      assignBlockToSlot(slots[slotIndex], block);
    }

    let freeLeft = Math.max(0, Math.floor(safeNumber(freePeopleCount)));

    slots.forEach(slot => {
      if (freeLeft <= 0) return;
      const remainingTarget = Math.max(0, slot.targetSize - slot.currentSize);
      const toAssign = Math.min(freeLeft, remainingTarget);
      slot.assignedFreePeopleCount += toAssign;
      slot.currentSize += toAssign;
      freeLeft -= toAssign;
    });

    while (freeLeft > 0 && slots.length) {
      const slotIndex = chooseBestSlotIndex(slots, 1, absMaxGroupSize);
      slots[slotIndex].assignedFreePeopleCount += 1;
      slots[slotIndex].currentSize += 1;
      freeLeft -= 1;
    }

    return {
      slots: slots.map(slot => ({
        machine: slot.machine,
        targetSize: slot.targetSize,
        assignedBlockIds: [...slot.assignedBlockIds],
        assignedFreePeopleCount: slot.assignedFreePeopleCount,
        actualSize: slot.currentSize
      })),
      unassignedFreePeopleCount: freeLeft
    };
  }

  global.MachineAssignmentService = {
    buildMachineQuotas,
    buildMachineAssignmentPlan
  };
})(window);