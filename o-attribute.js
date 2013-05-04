(function() {
    var o = oJS;
    if (!o) throw new Error('...');

    if (o.versions.core !== '0.0.5') throw new Error('...');
    if (o.versions.types !== '0.0.5') throw new Error('...');
    o.versions.attribute = '0.0.5';

    function ucFirst (str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    var methodType = o.anyType([
        o.nullType(),
        o.nonEmptyStringType()
    ]);

    var definitions = {
        key: {
            type: o.nonEmptyStringType(),
            required: true
        },
        argKey: {
            type: o.nonEmptyStringType(),
            devoid: function () { return this.key() }
        },
        valueKey: {
            type: o.nonEmptyStringType(),
            devoid: function () { return '_' + this.key() }
        },

        devoid: { type: o.definedType() },
        required: { type: o.booleanType() },
        type: {
            type: o.anyType([
                o.enumType(['undefined', 'object', 'boolean', 'number', 'string', 'function']),
                o.functionType()
            ])
        },
        filter: { type: o.functionType() },
        augments: { type: o.functionType() },
        chain: { type: o.booleanType() },

        reader: {
            type: methodType,
            devoid: function () { return this.key() }
        },
        writer: {
            type: methodType,
            devoid: function () { return this.key() }
        },
        predicate: {
            type: methodType,
            filter: function (val) { if (val === true) val = 'has' + ucFirst( this.key() ); return val },
            devoid: function () { return null }
        },
        clearer: {
            type: methodType,
            filter: function (val) { if (val === true) val = 'clear' + ucFirst( this.key() ); return val },
            devoid: function () { return null }
        },
        proxies: { type: o.objectOfType( o.nonEmptyStringType() ) }
    };

    var writers = {};
    var readers = {};
    for (var key in definitions) {
        writers[key] = o.writer( '_' + key, definitions[key] );
        readers[key] = o.reader( '_' + key, o.merge( { writer: writers[key] }, definitions[key] ) );
    }

    o.Attribute = o.construct(
        function (args) {
            for (var key in args) {
                writers[key].call( this, args[key] );
            }
        },
        o.merge(
            {
                readerMethod: o.reader('_readerMethod', {
                    type: o.functionType(),
                    devoid: function () {
                        return o.reader(
                            this.valueKey(),
                            {
                                devoid:    this.devoid(),
                                required:  this.required(),
                                writer:    this.writerMethod(),
                                predicate: this.predicateMethod()
                            }
                        );
                    }
                }),
                writerMethod: o.reader('_writerMethod', {
                    type: o.functionType(),
                    devoid: function () {
                        return o.writer(
                            this.valueKey(),
                            {
                                type: this.type(),
                                filter: this.filter(),
                                augments: this.augments(),
                                chain: this.chain()
                            }
                        );
                    }
                }),
                accessorMethod: o.reader('_accessorMethod', {
                    type: o.functionType(),
                    devoid: function () {
                        return o.accessor(
                            this.valueKey(),
                            {
                                writer: this.writerMethod(),
                                reader: this.readerMethod()
                            }
                        );
                    }
                }),
                predicateMethod: o.reader('_predicateMethod', {
                    type: o.functionType(),
                    devoid: function () {
                        return o.predicate( this.valueKey() );
                    }
                }),
                clearerMethod: o.reader('_clearerMethod', {
                    type: o.functionType(),
                    devoid: function () {
                        return o.clearer( this.valueKey() );
                    }
                }),
                proxyMethods: o.reader('_proxyMethods', {
                    type: o.objectOfType( o.functionType() ),
                    devoid: function () {
                        var methods = {};
                        var proxies = this.proxies();
                        if (proxies === undefined) return methods;

                        var attr = this;
                        for (var key in proxies) {
                            // The way JS closures work requires us to copy the key variable via
                            // a function call so that it does not get changed by the for loop.
                            methods[key] = (function (toMethod) {
                                return function () {
                                    var val = attr.getValue( this );
                                    return val[ toMethod ].apply( val, arguments );
                                };
                            })( proxies[key] );
                        }
                        return methods;
                    }
                }),

                getValue: function (obj) {
                    return this.readerMethod().call( obj );
                },
                setValue: function (obj, value) {
                    return this.writerMethod().call( obj, value );
                },
                hasValue: function (obj) {
                    return this.predicateMethod().call( obj );
                },
                clearValue: function (obj) {
                    return this.clearerMethod().call( obj );
                },

                install: function (obj) {
                    if (this.writer() !== null && this.writer() === this.reader()) {
                        obj[this.writer()] = this.accessorMethod();
                    }
                    else {
                        if (this.writer() !== null) obj[this.writer()] = this.writerMethod();
                        if (this.reader() !== null) obj[this.reader()] = this.readerMethod();
                    }

                    if (this.predicate() !== null) obj[this.predicate()] = this.predicateMethod();
                    if (this.clearer() !== null) obj[this.clearer()] = this.clearerMethod();

                    var proxyMethods = this.proxyMethods();
                    for (var key in proxyMethods) {
                        obj[key] = proxyMethods[key];
                    }
                }
            },
            readers
        )
    );
}).call(this);