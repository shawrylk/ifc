import { defineStore } from 'pinia';

interface PropertyValue {
  [key: string]: any;
}

interface ModelProperties {
  [expressId: string]: PropertyValue;
}

export const useModelPropertiesStore = defineStore('modelProperties', {
  state: () => ({
    properties: {} as ModelProperties,
  }),

  actions: {
    setProperties(properties: ModelProperties) {
      this.properties = properties;
    },

    getProperty(expressId: string): PropertyValue | undefined {
      return this.properties[expressId];
    },

    getReferencedProperties(expressId: string): PropertyValue[] {
      const property = this.properties[expressId];
      if (!property) return [{ expressId }];

      const referencedProps: PropertyValue[] = [property];
      const processedIds = new Set<string>();

      const processProperty = (prop: PropertyValue) => {
        Object.values(prop).forEach((value) => {
          if (typeof value === 'object' && value !== null) {
            if ('expressID' in value) {
              const refId = value.expressID.toString();
              if (!processedIds.has(refId)) {
                processedIds.add(refId);
                const refProp = this.properties[refId];
                if (refProp) {
                  referencedProps.push(refProp);
                  processProperty(refProp);
                }
              }
            }
            processProperty(value);
          }
        });
      };

      processProperty(property);
      return referencedProps;
    },
  },
});
